# 강동자바라 제작관리 - 작업완료 사진 버전

## 동작
1. 사무실에서 주문 등록
2. 공장 작업자가 휴대폰으로 factory.html 접속
3. 해당 주문에서 작업완료 사진 촬영
4. `작업완료` 버튼 클릭
5. 사진이 Supabase Storage에 업로드됨
6. 주문 상태가 작업완료로 변경됨
7. 사무실 화면에 실시간으로 작업완료 + 완료사진 표시

## 처음 한 번 설정
1. Supabase 프로젝트 생성
2. SQL Editor에서 `setup.sql` 실행
3. Storage에서 `completion-photos` 이름의 Public bucket 생성
4. `config.js`에 Project URL / anon key 입력
5. 전체 파일을 GitHub Pages에 업로드

## 주의
현재는 빠른 사내용 프로토타입이라 anon 접근 정책을 사용합니다.
외부 공개 주소로 오래 운영할 경우 로그인/권한 기능을 추가하는 것이 안전합니다.


## 2026-08-11 연결 오류 수정
- GitHub Pages/브라우저가 예전 config.js를 읽지 않도록 캐시 무효화 적용
- Supabase URL 공백/끝 슬래시 자동 정리
- `test.html` 연결 테스트 페이지 추가

업로드 후:
1. 저장소의 기존 파일을 이 버전으로 덮어쓰기
2. 1~2분 후 `https://choi2704.github.io/kd-factory-photo/test.html` 접속
3. `연결 테스트` 클릭
4. 성공이면 office.html / factory.html 사용
