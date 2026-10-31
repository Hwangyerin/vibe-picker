"""개발용 로컬 서버 — 캐시를 끈 python http.server

기본 http.server는 캐시 헤더를 보내지 않아서, 브라우저가 고치기 전의 CSS·JS를
그대로 쓰는 일이 생긴다(8단계 점검 때 v1 base.css가 계속 쓰였다).
이 서버는 모든 응답에 Cache-Control: no-store를 붙인다.

실행 (저장소 루트에서):
    python3 tools/serve.py          # http://127.0.0.1:8000
    python3 tools/serve.py 5500     # 포트 바꾸기
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"VibePicker 개발 서버: http://127.0.0.1:{port}  (캐시 끔, Ctrl+C로 종료)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
