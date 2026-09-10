import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    /**
     웹앱을 실제로 띄운 적이 있는가.

     화면 없이 깨어나는 경우(배경 오디오가 도는 중의 상태 복원 등)에 웹앱 전체를 불러오지
     않기 위한 문이다. 배경에서 깨어난 앱에게 시스템이 주는 시간은 몇 초뿐이고, 넘기면
     끝낸다 — sl_strength 에서 그게 충돌로 보였다.

     한 번 앞에 나온 뒤로는 계속 둔다. 뒤로 갈 때마다 치우면 다시 열 때 웹앱이 처음부터
     뜨고, 읽던 자리와 재생 중이던 낭독이 날아간다.
     */
    @State private var everActive = false

    var body: some View {
        Group {
            if everActive {
                WordflowWebView()
                    // 웹앱이 자기 여백을 직접 관리한다. 여기서 또 넣으면 두 번 들어간다.
                    .ignoresSafeArea(.container, edges: .bottom)
            } else {
                // 웹뷰가 뜨기 전 한 프레임 동안 흰 화면이 번쩍이지 않도록, 웹앱의 종이색을
                // 그대로 깔아 둔다(globals.css 의 --paper).
                Color(red: 0.980, green: 0.953, blue: 0.902)
                    .ignoresSafeArea()
            }
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            if phase == .active { everActive = true }
        }
    }
}
