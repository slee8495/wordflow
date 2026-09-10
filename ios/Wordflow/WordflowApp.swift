import AVFoundation
import SwiftUI

/**
 Wordflow — 아이폰에 사는 껍데기.

 화면은 웹앱이 이미 전부 갖고 있다. 이 앱이 존재하는 이유는 화면이 아니라 **소리와 자리**다:

 1. 홈 화면에 추가한 웹앱(PWA)은 사파리와 저장소가 분리돼 있어서 iOS 가 심심하면 날린다 —
    그러면 로그인이 풀리고, 매일 5분 쓰자는 앱이 매번 로그인부터 시작한다.
 2. 낭독을 켜 두고 화면을 끄면 웹앱은 멎는다. 네이티브 껍데기여야 백그라운드 오디오가 붙고,
    잠금 화면에 재생 컨트롤이 뜬다(웹이 이미 Media Session API 를 쓰고 있어서 껍데기만
    있으면 그대로 올라온다).
 3. TestFlight 로 가족에게 링크 하나로 깔 수 있다.

 그래서 화면은 웹뷰로 재사용하고, 네이티브는 오디오 세션과 바깥 링크만 맡는다.
 */
@main
struct WordflowApp: App {
    init() {
        /*
          낭독이 잠금 화면 뒤에서도 이어지게 하는 자리.

          기본 카테고리는 화면이 꺼지면 소리를 끊는다. `.playback` 으로 바꿔야 이어진다.

          **`setActive(true)` 는 부르지 않는다.** 카테고리를 정하는 것만으로는 남의 소리를
          끊지 않지만, 세션을 켜는 순간 듣고 있던 음악이 멈춘다 — 앱을 여는 것과 낭독을
          켜는 것은 다른 일이다. 실제로 소리를 낼 때 웹뷰가 알아서 켠다.
        */
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        } catch {
            // 실패해도 앱은 돌아야 한다. 잃는 것은 잠긴 화면에서의 낭독뿐이다.
            NSLog("[Wordflow] audio session: \(error.localizedDescription)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

enum Wordflow {
    static let homeURL = URL(string: "https://wordflow.sl-studio.dev")!
}
