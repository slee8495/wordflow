import SwiftUI
import UIKit
import WebKit

/**
 웹앱을 감싸는 웹뷰.

 기본값 그대로 두면 안 되는 게 하나 있고, 그게 이 앱의 절반이다 — **소리**.
 기본 웹뷰는 재생마다 사용자 탭을 요구한다. 낭독은 문단을 여러 조각으로 나눠서 이어
 재생하는데(`src/lib/speak.ts`), 두 번째 조각부터는 사람이 누른 결과가 아니라 앞 조각이
 끝난 결과다. 그대로 두면 첫 문장만 읽고 조용해진다.
 */
struct WordflowWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // 위 설명 참고. 이게 낭독을 살린다.
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        // 설치된 앱처럼 굴게 한다. 위아래로 튕기면 사파리 티가 난다.
        webView.scrollView.bounces = false
        webView.load(URLRequest(url: Wordflow.homeURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
        /**
         구글 로그인을 웹뷰 안에 둔다.

         사파리로 넘기면 깨진다. Auth.js 가 로그인을 시작하면서 PKCE 검증값을 **웹뷰
         쿠키에** 심는데 콜백은 사파리로 돌아오니 그 쿠키가 없다. iOS 는 웹뷰와 사파리의
         저장소를 분리하므로 한 흐름을 둘로 쪼개면 반드시 이렇게 된다
         (`InvalidCheck: pkceCodeVerifier value could not be parsed` — sl_strength 에서 겪음).

         나머지 바깥 주소는 iOS 에게 넘긴다. 유튜브 찬양·설교 링크가 그 이유다 — 웹뷰가
         그냥 열면 앱 안에 반쪽짜리 유튜브 웹페이지가 뜨고, 거기서는 로그인도 재생목록도
         없다. 시스템에 넘기면 유튜브 앱이 열리고 그때부터는 아이폰이 원래 하던 일을 한다.
         */
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard
                navigationAction.navigationType == .linkActivated,
                let url = navigationAction.request.url
            else {
                decisionHandler(.allow)
                return
            }

            // `tel:`·`mailto:` 는 호스트가 없다. 아래 호스트 검사만 있으면 그냥 통과해서
            // 웹뷰가 열려다 아무 일도 안 일어난다 — 죽은 링크가 된다.
            if url.scheme == "tel" || url.scheme == "sms" || url.scheme == "mailto" {
                decisionHandler(.cancel)
                UIApplication.shared.open(url)
                return
            }

            guard let host = url.host() else {
                decisionHandler(.allow)
                return
            }

            let staysInside =
                host.hasSuffix("wordflow.sl-studio.dev")
                || host.hasSuffix("vercel.app")
                || host.hasSuffix("accounts.google.com")
                || host.hasSuffix("google.com")

            if staysInside {
                decisionHandler(.allow)
                return
            }

            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        }

        /**
         **웹의 `alert`·`confirm` 은 앱이 직접 창을 띄워 줘야 한다.**

         안 하면 WKWebView 는 그 함수를 조용히 `false` 로 돌려보낸다. 화면에서는 버튼이
         고장 난 것처럼 보인다 — 계정 삭제나 가족 내보내기처럼 되묻는 자리가 전부 그렇게
         죽는다. sl_strength 에서 달력 삭제가 실제로 이렇게 안 먹었다.
         */
        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            present(message: message, actions: [("확인", true)]) { _ in completionHandler() }
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            present(message: message, actions: [("취소", false), ("확인", true)]) { ok in
                completionHandler(ok)
            }
        }

        private func present(
            message: String,
            actions: [(String, Bool)],
            done: @escaping (Bool) -> Void
        ) {
            guard
                let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
            else {
                // 띄울 자리가 없으면 **거절로 답한다.** 답을 안 주면 웹뷰가 통째로 멈춘다.
                done(false)
                return
            }

            let sheet = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            for (label, value) in actions {
                sheet.addAction(
                    UIAlertAction(title: label, style: value ? .default : .cancel) { _ in done(value) }
                )
            }
            var top = root
            while let next = top.presentedViewController { top = next }
            top.present(sheet, animated: true)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("[Wordflow] navigation failed: \(error.localizedDescription)")
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            NSLog("[Wordflow] load failed: \(error.localizedDescription)")
        }
    }
}
