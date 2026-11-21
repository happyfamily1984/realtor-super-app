#!/usr/bin/env bash
# 손님용 APK 만들기
#   ./build.sh <배포 주소> <서명 키 파일> <서명 키 암호> [버전 번호]
#   예) ./build.sh my-app.vercel.app ~/customer.keystore 'secret' 2
# 서명 키 파일은 한 번 만들어 계속 같은 것을 써야 앱 업데이트가 됩니다. 저장소에 올리지 마세요.
#   keytool -genkeypair -keystore customer.keystore -alias customer -keyalg RSA -keysize 2048 -validity 10000
set -euo pipefail
cd "$(dirname "$0")"
HOST="${1:?배포 주소를 넣어 주세요 (예: my-app.vercel.app)}"
KS="$(realpath "${2:?서명 키 파일 경로}")"
PASS="${3:?서명 키 암호}"
gradle --no-daemon -q :app:assembleRelease -PtwaHost="$HOST" -PksFile="$KS" -PksPass="$PASS" -PverCode="${4:-1}"
APK=app/build/outputs/apk/release/app-release.apk
echo "APK: $(realpath "$APK")"
echo "아래 지문을 웹앱의 public/.well-known/assetlinks.json 에 넣어야 주소창 없이 전체 화면으로 열립니다:"
keytool -list -v -keystore "$KS" -storepass "$PASS" -alias customer 2>/dev/null | grep 'SHA256:' | sed 's/^[[:space:]]*//'
