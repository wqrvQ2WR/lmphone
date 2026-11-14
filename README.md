# lmphone

맥에서 돌아가는 LM Studio 모델을, 폰 브라우저로 쓰는 웹앱.
다른 와이파이/LTE에서도 됨 (Cloudflare 빠른 터널, 계정 불필요).

```
폰 브라우저 ──인터넷──> Cloudflare 터널 ──> 맥:8787 (lmphone) ──> 맥:1234 (LM Studio)
```

## 쓰는 법

1. LM Studio 켜고 모델 로드 → Developer 탭에서 서버 Running
2. 터미널에서:

```bash
~/Desktop/폴더임/capp/lmphone/start.sh
```

3. 맥 브라우저에 QR 페이지가 자동으로 뜸 → 폰 카메라로 스캔 → 끝
4. 끌 때는 Ctrl+C (또는 `./stop.sh`)

접속 키는 스캔 한 번으로 폰에 쿠키로 저장돼서, 다음부턴 주소만 열면 됨.

## 기능

- 스트리밍 답변, 중간에 중지
- 모델 전환 (LM Studio에 로드된 목록 자동으로 가져옴)
- **생각하기 켜기/끄기** — 헤더의 `생각` 버튼(또는 설정)으로 토글.
  끄면 `reasoning_effort: "none"` 을 보내서 추론 모델이 사고 과정을 건너뜀 (훨씬 빠름).
  생각 안 하는 모델(llama 등)엔 아무 영향 없음
- 켜둔 경우 생각 과정은 접어서 따로 표시
- 대화 여러 개 저장 (폰 localStorage, 서버엔 안 남음)
- 시스템 프롬프트 / 온도 / 최대 토큰 / 기억할 대화 수 조절
- 마크다운, 코드 블록, 복사 버튼

## 알아둘 것

- **터널 주소는 켤 때마다 바뀜.** 고정 주소가 필요하면 Cloudflare 계정 붙여서 named tunnel을 쓰거나, Tailscale을 쓰면 됨.
- 접속 키(`.token`)가 곧 비밀번호. 유출되면 `.token` 지우고 다시 켜면 새로 생김.
- 같은 와이파이면 터널 없이 `http://<맥 IP>:8787` 로도 됨.
- 맥이 잠들면 끊김. 계속 쓰려면 `caffeinate -s ./start.sh`.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8787 | lmphone 포트 |
| `LM_PORT` | 1234 | LM Studio 서버 포트 |
| `LMPHONE_TOKEN` | 자동생성 | 접속 키 고정하고 싶을 때 |

## 구성

- `server.js` — 정적 파일 + LM Studio 프록시 (node 내장 모듈만, 의존성 0)
- `public/index.html` — 폰용 채팅 UI
- `public/qr.html` — 접속 QR
- `public/locked.html` — 키 입력 화면
- `start.sh` / `stop.sh`
