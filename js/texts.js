/* 사이트에 나오는 글자 전부.
   관리자 페이지 "글자" 탭에서 바꾸면 site.json 의 texts 가 이 기본값을 덮어쓴다.
   {name} 처럼 중괄호로 감싼 곳은 화면에서 실제 값으로 바뀌는 자리다. */

const TEXT_SECTIONS = [
  { id: 'intro', name: '첫 화면', items: [
    ['intro.kicker', '맨 위 작은 글씨', 'Stellar Live Archive'],
    ['intro.title', '큰 제목', 'STELLIVE'],
    ['intro.sub', '기울인 부제', 'Archive'],
    ['intro.ko', '한글 한 줄', '별들의 노래와 순간을 모아 두는 곳'],
    ['intro.enter', '들어가기 버튼', 'ENTER'],
    ['intro.skip', '다시 보지 않기', '오늘 하루 다시 보지 않기'],
    ['intro.wallEn', '왼쪽 벽 영문', 'Since the first star\n— a fan archive', true],
    ['intro.wallKo', '왼쪽 벽 안내', '팬이 만든 비공식 아카이브 ·\n스텔라이브 공식 활동이 아니다', true],
    ['meta.title', '브라우저 탭 제목', 'STELLIVE ARCHIVE'],
    ['meta.description', '검색·공유 설명', '팬이 만든 비공식 스텔라이브 아카이브 — 멤버별 커버곡 · 오리곡 · 클립 · 팬아트'],
    ['brand.name', '사이트 이름 (목차·맨 아래·위 줄)', 'STELLIVE'],
    ['brand.sub', '사이트 이름 뒤 기울인 글씨 (맨 아래)', 'Archive'],
  ] },
  { id: 'nav', name: '목차 · 위 링크 줄', items: [
    ['nav.title', '목차 제목', 'INDEX'],
    ['nav.home', '홈', '홈'], ['nav.homeEn', '홈 (영문)', 'Home'],
    ['nav.calendar', '캘린더', '캘린더'], ['nav.calendarEn', '캘린더 (영문)', 'Calendar'],
    ['nav.schedule', '방송 일정', '방송 일정'], ['nav.scheduleEn', '방송 일정 (영문)', 'Schedule'],
    ['nav.listen', '노래 듣기', '노래 듣기'], ['nav.listenEn', '노래 듣기 (영문)', 'Listen'],
    ['nav.shorts', '쇼츠 · 클립', '쇼츠 · 클립'], ['nav.shortsEn', '쇼츠 · 클립 (영문)', 'Shorts'],
    ['nav.group', '단체', '단체 · 합방'], ['nav.groupEn', '단체 (영문)', 'Units'],
    ['nav.stars', '별표', '별표'], ['nav.starsEn', '별표 (영문)', 'Stars'],
    ['nav.about', 'About', '소개 · 가이드라인'], ['nav.aboutEn', 'About (영문)', 'About'],
    ['nav.members', '멤버 묶음 제목', 'MEMBERS'],
    ['nav.graduation', '졸업 묶음 이름', 'Graduation'],
    ['nav.upload', '올리기 버튼', '＋ 올리기'],
    ['nav.intro', '첫 화면 버튼', 'INTRO'],
  ] },
  { id: 'home', name: '홈', items: [
    ['home.kicker', '배너 작은 글씨', 'Stellar Live Archive'],
    ['home.title', '배너 제목', 'STELLIVE'],
    ['home.sub', '배너 한 줄', '별들의 노래와 순간을 모아 두는 곳'],
    ['home.songs', '노래 수 옆 글씨', '노래'],
    ['home.others', '클립 수 옆 글씨', '클립 · 팬아트'],
    ['home.cafe', '팬 카페 버튼 설명', '팬 카페로 간다'],
    ['home.graduation', '졸업 큰 제목', 'GRADUATION'],
    ['home.graduationKo', '졸업 작은 제목', '졸업 멤버'],
  ] },
  { id: 'cal', name: '캘린더', items: [
    ['cal.kicker', '작은 제목', 'CALENDAR'],
    ['cal.upcoming', '다가오는 일정', '다가오는 일정'],
    ['cal.none', '일정이 없을 때', '일정이 없다'],
    ['cal.today', '오늘 버튼', '오늘'],
    ['sch.big', '방송 일정 큰 제목', 'Schedule'],
    ['sch.ko', '방송 일정 한글 제목', '방송 일정'],
    ['sch.desc', '방송 일정 설명', '멤버들의 방송 · 휴방 일정. 구글 로그인하면 누구나 넣을 수 있다'],
    ['sch.month', '방송 일정 달 표시', '{y}년 {m}월'],
    ['sch.add', '일정 넣기 버튼', '일정 넣기'],
    ['sch.addHere', '이 날에 넣기 버튼', '이 날에 넣기'],
    ['sch.login', '로그인 안 했을 때', '구글 로그인하면 일정을 넣을 수 있다'],
    ['sch.none', '그날 일정이 없을 때', '이 날은 아직 일정이 없다'],
    ['sch.added', '일정 넣었을 때', '방송 일정에 넣었다'],
    ['sch.confirmDelete', '일정 지울 때', '이 일정을 지울까?'],
    ['sch.link', '캘린더에서 방송 일정으로', '멤버 방송 일정 보기'],
    ['sch.cancel', '취소', '취소'],
    ['sch.save', '저장', '저장'],
    ['sch.f.date', '날짜', '날짜'], ['sch.f.time', '시간', '시간 (없으면 하루 종일)'], ['sch.f.member', '멤버', '멤버'],
    ['sch.f.type', '종류', '종류'], ['sch.f.title', '내용', '내용 (비우면 종류 이름)'], ['sch.f.titlePh', '내용 안내', '예: 저챗 + 콜 오브 듀티'],
    ['sch.f.url', '링크', '링크 (선택)'],
    ['sch.type.live', '종류: 방송', '방송'], ['sch.type.plan', '종류: 방송 예정', '방송 예정'], ['sch.type.off', '종류: 휴방', '휴방'],
    ['sch.type.song', '종류: 노래 방송', '노래 방송'], ['sch.type.etc', '종류: 기타', '기타'],
    ['att.button', '출석 버튼', '오늘 출석하기'],
    ['att.checking', '출석하는 중', '도장 찍는 중…'],
    ['att.today', '오늘 출석했을 때', '오늘 출석 완료'],
    ['att.days', '출석 일수 뒤 글자', '일 출석'],
    ['att.streak', '연속 출석', '{n}일 연속'],
    ['att.stamp', '캘린더 도장 글자', '출석'],
    ['att.done', '출석 도장 찍었을 때', '출석 도장 쾅! 지금까지 {n}일'],
    ['att.login', '로그인 안 했을 때', '구글 로그인하면 매일 출석 도장을 찍을 수 있다'],
    ['cal.happy', '캘린더 생일 칸 글씨', 'Happy Birthday'],
    ['cal.big', '캘린더 페이지 큰 제목', 'Calendar'],
    ['cal.ko', '캘린더 페이지 한글 제목', '캘린더'],
    ['cal.desc', '캘린더 페이지 설명', '생일 · 데뷔 기념일 · 이벤트'],
    ['cal.months', '달 이름 (쉼표로 12개)', 'January, February, March, April, May, June, July, August, September, October, November, December'],
    ['cal.days', '요일 (쉼표로 7개, 일요일부터)', 'SUN, MON, TUE, WED, THU, FRI, SAT'],
    ['cal.monthDay', '고른 날 제목', '{m}월 {d}일'],
    ['event.birthday', '일정 종류: 생일', '생일'],
    ['event.debut', '일정 종류: 데뷔', '데뷔'],
    ['event.event', '일정 종류: 이벤트', '이벤트'],
    ['event.broadcast', '일정 종류: 방송', '방송'],
    ['event.release', '일정 종류: 발매', '발매'],
    ['event.etc', '일정 종류: 기타', '기타'],
    ['event.mine', '일정 종류: 내 일정', '내 일정'],
    ['my.add', '내 일정 추가 버튼', '내 일정 추가'],
    ['my.placeholder', '내 일정 칸 안내', '무슨 일정? (예: 린 생일 방송 보기)'],
    ['my.save', '내 일정 저장 버튼', '저장'],
    ['my.private', '내 일정 안내', '나만 보이는 일정이다'],
    ['my.added', '내 일정 저장했을 때', '내 일정에 넣었다'],
    ['my.confirmDelete', '내 일정 지울 때', '이 일정을 지울까?'],
    ['event.birthdayTitle', '생일 일정 이름', '{name} 생일'],
    ['event.debutTitle', '데뷔 기념일 이름', '{name} 데뷔 {n}주년'],
  ] },
  { id: 'profile', name: '멤버 프로필', items: [
    ['profile.back', '왼쪽 위 돌아가기', 'INDEX'],
    ['profile.ci', '그림 아래 글씨', 'CHARACTER\nINFORMATION', true],
    ['profile.birthday', '생일 칸', '생일'],
    ['profile.debut', '데뷔 칸', '데뷔'],
    ['profile.unit', '유닛 칸', '유닛'],
    ['profile.species', '종족 칸', '종족'],
    ['profile.age', '나이 칸', '나이'],
    ['profile.mbti', 'MBTI 칸', 'MBTI'],
    ['profile.height', '신장 칸', '신장'],
    ['profile.oshi', '오시마크 칸', '오시마크'],
    ['profile.fanName', '팬네임 칸', '팬네임'],
    ['profile.graduated', '졸업 멤버 유닛 칸', '졸업 멤버'],
    ['profile.summary', '소개 제목', 'Summary'],
    ['profile.playAll', '노래 전부 듣기', '노래 전부 듣기'],
    ['profile.addFanart', '팬아트 빈칸', '＋ 팬아트'],
    ['profile.unitLine', '이름 아래 줄', 'Stellive · {unit}'],
    ['profile.gradUnit', '졸업 멤버 이름 아래 줄의 유닛', 'Graduation'],
    ['profile.navGrad', '졸업 멤버 위쪽 가운데', 'GRADUATION'],
    ['profile.month', '생일 표시', '{m}월 {d}일'],
    ['link.chzzk', '치지직 버튼', '치지직'],
    ['link.x', 'X 버튼', 'X'],
    ['link.youtube', '유튜브 버튼', 'YouTube'],
    ['link.namu', '나무위키 버튼', '나무위키'],
  ] },
  { id: 'list', name: '목록 · 빈 화면', items: [
    ['list.count', '노래 개수', '{n}곡'],
    ['list.shuffle', '랜덤 버튼', '랜덤'],
    ['list.playAll', '전부 듣기 버튼', '전부 듣기'],
    ['list.add', '올리기 버튼', '＋ {kind} 올리기'],
    ['list.empty', '아무것도 없을 때', '아직 {kind}이(가) 없다'],
    ['list.first', '처음 올리기 버튼', '＋ 처음으로 올리기'],
    ['list.open', '원본 열기', '원본'],
    ['notFound', '없는 주소', '여긴 아무것도 없는 우주다'],
    ['list.groupTag', '단체곡 표시', '{label} 단체'],
    ['list.allTag', '전체 단체곡 표시', '전체'],
    ['list.clipTitle', '제목 없는 클립', '클립'],
    ['list.linkView', '그림 없는 링크', '링크로 보기'],
    ['list.srcYt', '유튜브 표시', 'YouTube'],
    ['list.srcDrive', '드라이브 표시', 'Drive'],
    ['list.delete', '지우기 버튼 설명', '지우기'],
    ['list.rename', '제목 고치기 버튼 설명', '제목 고치기'],
    ['list.renamePrompt', '제목 고칠 때 묻는 말', '새 제목을 적자'],
    ['list.renamed', '제목을 고쳤을 때', '제목을 고쳤다'],
    ['list.star', '별표 버튼 설명', '별표'],
    ['viewer.cant', '보기 창에서 못 보여 줄 때', '여기서는 바로 못 보여 준다'],
    ['viewer.by', '보기 창 올린 사람', '올린 사람 {name}'],
  ] },
  { id: 'group', name: '단체 · 합방', items: [
    ['group.big', '큰 제목', 'Units'],
    ['group.ko', '한글 제목', '단체 · 합방'],
    ['group.all', '전부 탭', 'All'],
    ['group.duo', '합방 탭', 'Duo'],
    ['group.duoKo', '합방 탭 한글', '합방'],
  ] },
  { id: 'listen', name: '노래 듣기', items: [
    ['listen.big', '큰 제목', 'Listen'],
    ['listen.ko', '한글 제목', '노래 듣기'],
    ['listen.desc', '설명', '고르면 아래 플레이어에서 끝날 때마다 다음 곡으로 넘어간다'],
    ['listen.preferNote', '드라이브 버튼 앞 설명', '유튜브가 막힌 곳(학교 등)이면'],
    ['listen.prefer', '드라이브 버튼', '드라이브 먼저 틀기'],
    ['listen.full', '다 받고 틀기 버튼', '끊김 없이 (받아 두며 듣기)'],
    ['listen.fullTitle', '다 받고 틀기 설명', '드라이브 곡을 바로 틀면서 뒤에서 끝까지 받아 둔다. 다 받아지면 끊기지 않고, 받은 곡은 이 브라우저에 저장돼서 다음엔 바로, 인터넷 없이도 나온다'],
    ['listen.saved', '받아 둔 노래', '받아 둔 노래 {n}곡 · {mb}MB'],
    ['listen.clear', '받아 둔 노래 비우기', '비우기'],
    ['listen.clearConfirm', '비우기 확인', '이 브라우저에 받아 둔 노래를 모두 지울까?'],
    ['listen.coverNote', 'mp3 표지 버튼 앞 설명', 'mp3 표지'],
    ['listen.coverFanart', 'mp3 표지: 팬아트', '팬아트 랜덤'],
    ['listen.coverProfile', 'mp3 표지: 프로필', '프로필 사진'],
    ['listen.random', '전체 랜덤', '전체 랜덤'],
    ['listen.stars', '별표한 노래', '별표한 노래'],
    ['listen.newest', '최신순', '최신순'],
    ['listen.newestDesc', '최신순 설명', '새로 올라온 것부터'],
    ['listen.members', '멤버별 제목', '멤버별'],
    ['listen.units', '기수별 제목', '기수별'],
    ['listen.search', '찾기 칸', '제목이나 멤버로 찾기'],
    ['listen.membersK', '멤버별 작은 제목', 'MEMBERS'],
    ['listen.unitsK', '기수별 작은 제목', 'UNITS'],
    ['listen.account', '별표 저장 위치: 계정', '구글 계정'],
    ['listen.device', '별표 저장 위치: 기기', '이 기기'],
    ['listen.memberQueue', '멤버 노래 재생 목록 이름', '{name} 노래'],
    ['listen.unitQueue', '기수 노래 재생 목록 이름', '{label} 노래'],
  ] },
  { id: 'stars', name: '별표', items: [
    ['stars.big', '큰 제목', 'Stars'],
    ['stars.ko', '한글 제목', '별표'],
    ['stars.login', '로그인했을 때', '{name} 계정에 저장된다'],
    ['stars.local', '로그인 안 했을 때', '이 기기에만 저장된다. 로그인하면 계정에 합쳐진다'],
    ['stars.empty', '별표가 없을 때', '☆ 를 눌러서 모아 보자'],
    ['stars.music', '노래 묶음 제목', '노래'],
    ['stars.clips', '클립 묶음 제목', '클립'],
    ['stars.arts', '팬아트 묶음 제목', '팬아트 · 짤'],
    ['stars.none', '별표한 노래가 없을 때 알림', '별표한 노래가 없다'],
  ] },
  { id: 'kind', name: '종류 이름', items: [
    ['kind.cover', '커버곡', '커버곡'], ['kind.coverEn', '커버곡 (영문)', 'Covers'],
    ['kind.original', '오리곡', '오리곡'], ['kind.originalEn', '오리곡 (영문)', 'Originals'],
    ['kind.album', '앨범', '앨범'], ['kind.albumEn', '앨범 (영문)', 'Albums'],
    ['kind.clip', '클립', '클립'], ['kind.clipEn', '클립 (영문)', 'Clips'],
    ['kind.shorts', '쇼츠', '쇼츠'], ['kind.shortsEn', '쇼츠 (영문)', 'Shorts'],
    ['kind.fanart', '팬아트', '팬아트'], ['kind.fanartEn', '팬아트 (영문)', 'Fan art'],
    ['kind.meme', '짤', '짤'], ['kind.memeEn', '짤 (영문)', 'Memes'],
  ] },
  { id: 'about', name: 'About', items: [
    ['about.big', '큰 제목', 'About'],
    ['about.ko', '한글 제목', '이 사이트에 대해'],
    ['about.lead', '소개 글 (**굵게**)', 'STELLIVE ARCHIVE는 스텔라이브를 좋아하는 **팬이 만든 비공식 팬 아카이브**입니다. 스텔라이브의 공식 활동이 아니며, 스텔라이브 및 소속 멤버와 관계가 없습니다. 멤버들의 노래와 순간, 팬들의 창작물을 한곳에서 찾아보기 쉽게 모아 두는 목적입니다.', true],
    ['about.promiseKicker', '주의한 점 작은 제목', 'OUR PROMISE'],
    ['about.promise', '주의한 점 제목', '사이트 주의점'],
    ['about.promiseNote', '주의한 점 설명', '스텔라이브 2차 창작 가이드라인에 맞춰 이렇게 운영합니다.'],
    ['about.contact', '삭제 요청 문장', '삭제 요청:'],
    ['about.guideKicker', '가이드라인 작은 제목', 'GUIDELINE'],
    ['about.guide', '가이드라인 제목', '스텔라이브 2차 창작 가이드라인'],
    ['about.source', '출처 안내', '출처: 스텔라이브 공식 2차 창작 가이드라인.', true],
  ] },
  { id: 'footer', name: '맨 아래', items: [
    ['footer.note', '로고 아래 글', '팬이 만든 비공식 아카이브다.\n모든 영상·이미지의 권리는 스텔라이브와 원작자에게 있다.', true],
    ['footer.archive', '첫째 묶음', 'ARCHIVE'],
    ['footer.contribute', '둘째 묶음', 'CONTRIBUTE'],
    ['footer.official', '셋째 묶음', 'OFFICIAL'],
    ['footer.officialSite', '공식 사이트 링크', '스텔라이브 공식 사이트'],
    ['footer.admin', '관리자 링크', '관리자'],
    ['footer.privacy', '개인정보처리방침 링크', '개인정보처리방침'],
    ['footer.loginOn', '로그인했을 때', '{name} · 별표는 계정에 저장된다'],
    ['footer.loginOff', '로그인 안 했을 때', '로그인하지 않으면 별표는 이 기기에만 저장된다'],
    ['footer.top', '맨 위로 버튼', 'TOP'],
    ['login.button', '구글 로그인 버튼', '구글 로그인'],
    ['login.logout', '로그아웃 버튼', '로그아웃'],
  ] },
  { id: 'upload', name: '올리기 창', items: [
    ['upload.title', '제목', '올리기'],
    ['upload.demo', '미리보기 모드 안내', '지금은 미리보기 모드라 링크만 이 브라우저에 저장된다. 서버를 연결하면 모두에게 보인다.'],
    ['upload.as', '로그인했을 때', '{name} 이름으로 올라간다. 파일은 공유 드라이브의 멤버 폴더에 들어간다.'],
    ['upload.login', '로그인 안 했을 때', '올리려면 먼저 목차 아래에서 구글 로그인을 하자.'],
    ['upload.rules', '아래 주의 문구', '올리기 전에 2차 창작 가이드라인을 확인하자. 원본 공개 전 클립, 방송 전체를 담은 영상은 받지 않는다.'],
    ['upload.done', '올린 뒤', '올렸다 ✦'],
    ['upload.deleting', '지우는 중', '지우는 중…'],
    ['upload.saving', '고치는 중', '저장하는 중…'],
    ['upload.doneAs', '쇼츠·클립 올린 뒤', '{kind}(으)로 올렸다 ✦'],
    ['upload.deleted', '지운 뒤', '지웠다'],
    ['upload.confirmDelete', '지우기 확인', '지울까?'],
    ['upload.kind', '칸: 종류', '종류'],
    ['upload.members', '칸: 멤버', '멤버'],
    ['upload.membersNote', '멤버 칸 설명', '두 명 이상 고르면 합방으로 들어간다'],
    ['upload.group', '칸: 단체곡', '단체곡이면'],
    ['upload.groupNote', '단체곡 칸 설명', '기수 전체가 부른 곡 등'],
    ['upload.groupNo', '단체곡 아님', '아님'],
    ['upload.groupAll', '전체 단체곡', '전체 단체곡'],
    ['upload.titleField', '칸: 제목', '제목'],
    ['upload.titlePh', '제목 칸 안내', '비워 두면 파일 이름으로'],
    ['upload.where', '어디서 보나 묶음', '어디서 보나'],
    ['upload.whereNote', '어디서 보나 설명', '하나 이상 · 노래는 둘 다 넣으면 유튜브가 막힌 곳에서도 들린다'],
    ['upload.link', '칸: 링크', '링크'],
    ['upload.linkNote', '링크 칸 설명', '유튜브 · 치지직 클립 · X'],
    ['upload.drop', '파일 칸', '드라이브에 올릴 파일 — 끌어다 놓거나 눌러서 고르기'],
    ['upload.alt', '칸: 드라이브 링크', '또는 이미 드라이브에 있는 파일 링크'],
    ['upload.altNote', '드라이브 링크 칸 설명', '큰 영상은 드라이브에 직접 올리고 링크만'],
    ['upload.submit', '올리기 버튼', '올리기'],
    ['upload.errMember', '멤버를 안 골랐을 때', '멤버를 고르자'],
    ['upload.videoKind', '올리기: 쇼츠·클립 칸', '쇼츠 · 클립'],
    ['upload.errNone', '아무것도 안 넣었을 때', '링크나 파일을 하나 이상 넣자'],
    ['upload.errSize', '파일이 클 때', '{mb}MB 까지만 된다. 큰 영상은 드라이브에 직접 올리고 링크를 붙이자'],
    ['upload.errDemo', '미리보기 모드에서 파일', '파일 올리기는 서버를 연결한 뒤에 된다'],
    ['upload.errLink', '링크가 이상할 때', '링크가 이상하다'],
    ['upload.reading', '파일 읽는 중', '파일 읽는 중…'],
    ['upload.uploading', '드라이브에 올리는 중', '드라이브에 올리는 중… (큰 파일은 1분쯤 걸린다)'],
    ['upload.uploadingP', '드라이브에 올리는 중 (진행률)', '드라이브에 올리는 중… {p}%'],
    ['upload.sending', '링크 올리는 중', '올리는 중…'],
  ] },
  { id: 'player', name: '플레이어', items: [
    ['shorts.big', '쇼츠 큰 제목', 'Shorts & Clips'],
    ['cm.title', '댓글 제목', '댓글'],
    ['cm.loading', '댓글 불러오는 중', '불러오는 중…'],
    ['cm.empty', '댓글이 없을 때', '아직 댓글이 없다. 첫 댓글을 남겨 보자'],
    ['cm.placeholder', '댓글 칸 안내', '댓글을 남겨 보자 (500자까지)'],
    ['cm.send', '댓글 등록 버튼', '등록'],
    ['cm.login', '로그인 안 했을 때', '구글 로그인하면 댓글을 쓸 수 있다'],
    ['cm.confirmDelete', '댓글 지울 때 묻는 말', '이 댓글을 지울까?'],
    ['shorts.all', '쇼츠 전체 버튼', '전체'],
    ['shorts.empty', '쇼츠·클립이 없을 때', '아직 올라온 게 없다. 유튜브 쇼츠나 클립 링크를 올려 보자'],
    ['shorts.upload', '쇼츠 화면 올리기 버튼', '+ 올리기'],
    ['shorts.copy', '쇼츠 링크 복사 버튼', '링크 복사'],
    ['shorts.copied', '링크 복사했을 때', '링크를 복사했다'],
    ['player.preferDrive', '드라이브 먼저', '드라이브 먼저'],
    ['player.preferYt', '유튜브 먼저', '유튜브 먼저'],
    ['player.queue', '재생 목록', '재생 목록'],
    ['player.noSongs', '틀 노래가 없을 때', '틀 수 있는 노래가 없다'],
    ['player.ytBlocked', '유튜브가 안 열릴 때', '유튜브가 열리지 않는다.'],
    ['player.ytError', '유튜브 재생이 막혔을 때', '유튜브에서 재생이 막혀 있다.'],
    ['player.driveError', '드라이브 파일이 안 열릴 때', '드라이브 파일이 열리지 않는다.'],
    ['player.switch', '다른 쪽으로 바꿀 때', '{why} → {to}로 튼다'],
    ['player.skip', '다음 곡으로 넘길 때', '{why} 다음 곡으로 넘어간다'],
    ['player.toDrive', '드라이브 이름', '드라이브 파일'],
    ['player.toYt', '유튜브 이름', '유튜브'],
    ['player.frame', '미리보기 창으로 열 때', '직접 재생이 안 돼서 드라이브 미리보기로 열었다'],
    ['player.frameNote', '자동으로 안 넘어갈 때', '드라이브 미리보기 창이라 끝나도 자동으로 안 넘어간다'],
    ['player.open', '노래 창 여는 버튼 설명', '노래 창으로 크게 보기'],
    ['np.k', '노래 창 위 작은 글씨', 'NOW PLAYING'],
    ['np.ko', '노래 창 이름', '노래 창'],
    ['np.of', '몇 번째 곡', '{n} / {total}'],
    ['np.next', '노래 창 목록 제목', '재생 목록'],
    ['np.nextK', '노래 창 목록 작은 글씨', 'UP NEXT'],
    ['np.back', '돌아가기 버튼', '돌아가기'],
    ['np.mini', '작은 창으로 버튼', '작은 창으로 보면서 둘러보기'],
    ['np.fav', '노래 창 별표 버튼', '별표'],
    ['np.src', '원본 링크 버튼', '원본 보기'],
    ['np.empty', '틀고 있는 노래가 없을 때', '지금 틀고 있는 노래가 없다.'],
    ['np.go', '노래 들으러 가는 버튼', '노래 들으러 가기'],
    ['player.loading', '곡을 받는 중', '저장 중 {p}%'],
    ['player.ready', '재생 목록에서 받아 둔 곡 표시', '받아 둠'],
    ['player.local', '미리 받아 둔 곡 설명', '미리 받아 둔 곡이라 인터넷이 끊겨도 나온다'],
    ['player.preferTitle', '드라이브/유튜브 버튼 설명', '누르면 바뀐다. 유튜브가 막힌 곳(학교 등)에서는 드라이브 먼저로 두자'],
  ] },
];

const TEXT_DEFAULT = Object.fromEntries(TEXT_SECTIONS.flatMap(s => s.items.map(([k, , v]) => [k, v])));

// 편집 모드(?edit): 글자마다 보이지 않는 표시로 키를 붙여 두고, 화면에 그린 뒤 고칠 수 있는 칸으로 바꾼다
const EDIT = new URLSearchParams(location.search).has('edit');
const MARK = /([^]*)([^]*)/g;
const stripMarks = s => String(s ?? '').replace(/[^]*/g, '').replace(//g, '');

// 실제 글자 (관리자가 바꾼 것 → 없으면 기본값). {name} 자리를 채운다
function tRaw(key, vars) {
  const custom = Data.site?.texts?.[key];
  let s = custom != null && custom !== '' ? custom : TEXT_DEFAULT[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? stripMarks(vars[k]) : m));
  return s;
}
// t('list.empty', { kind: '커버곡' }) — 화면에 그릴 글자
function t(key, vars) {
  const s = tRaw(key, vars);
  return EDIT ? `${key}${s}` : s;
}
// 줄바꿈과 **굵게** 를 살린 HTML
function th(key, vars) {
  const html = esc(tRaw(key, vars)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  return EDIT ? `<span class="ed-t" data-tk="${esc(key)}">${html}</span>` : html;
}

// 종류 이름(커버곡…)도 관리자 글자로 바꿀 수 있다
function applyKindNames() {
  KINDS.forEach(k => { k.name = t('kind.' + k.id); k.en = t('kind.' + k.id + 'En'); });
}

/* 사이트 이미지 — 관리자 "사이트" 탭에서 바꾼다. 비워 두면 기본 그림 */
const IMAGE_SLOTS = [
  ['logo', '로고 (첫 화면 · 목차 · 맨 아래 · 탭 아이콘)', 'assets/logo.svg'],
  ['intro', '첫 화면 오른쪽 그림 (비우면 배너 그림)', ''],
  ['crest', '첫 화면 왼쪽 벽 문양 (비우면 로고 선 그림)', ''],
  ['cafe', '팬 카페 버튼 그림 (비우면 로고)', ''],
  ['drawer', '목차 배경 그림', ''],
  ['footer', '맨 아래 배경 그림', ''],
  ['profileBg', '멤버 프로필 그림 뒤 배경 (멤버별 배경이 없을 때)', ''],
];
function siteImg(key, w = 1600) {
  const v = firstSrc(Data.site?.images?.[key]);
  if (v) return imgUrl(v, w);
  if (key === 'cafe') return siteImg('logo', w);
  if (key === 'intro') return imgUrl(firstSrc(Data.site?.banner?.image), w);
  return IMAGE_SLOTS.find(s => s[0] === key)?.[2] || '';
}

/* ─── 그림 겹 ───
   그림 칸 값은 예전처럼 주소 하나("https://…")이거나, 여러 장을 겹친 것:
   { layers: [ { src, fit: 'cover'|'contain', ox, oy, zoom }   ← 영역을 채우는 그림 (끌어서 위치, 확대)
              { src, fit: 'free', x, y, w, r }               ← 자유 그림 (위치 %, 너비 %, 회전) ], overflow: 영역 밖으로 나가도 보이기 } */
function layersOf(v, def = {}) {
  if (!v) return { layers: [], overflow: false };
  if (typeof v === 'string') return { layers: [{ src: v, fit: def.fit || 'cover', ox: def.ox ?? 50, oy: def.oy ?? 50, zoom: 1 }], overflow: false };
  return { layers: Array.isArray(v.layers) ? v.layers.filter(l => l && l.src) : [], overflow: !!v.overflow };
}
const firstSrc = v => (typeof v === 'string' ? v : layersOf(v).layers[0]?.src || '');
function layerStyle(L) {
  const n = (v, d) => (Number.isFinite(+v) ? +v : d);
  if (L.fit === 'free') return `left:${n(L.x, 50)}%;top:${n(L.y, 50)}%;width:${n(L.w, 40)}%;transform:translate(-50%,-50%) rotate(${n(L.r, 0)}deg)`;
  const ox = n(L.ox, 50), oy = n(L.oy, 50);
  return `object-fit:${L.fit === 'contain' ? 'contain' : 'cover'};object-position:${ox}% ${oy}%;transform:scale(${n(L.zoom, 1)});transform-origin:${ox}% ${oy}%`;
}
function layersHtml(v, def) {
  const { layers, overflow } = layersOf(v, def);
  if (!layers.length) return '';
  return `<div class="lays${overflow ? ' ov' : ''}" aria-hidden="true">${layers.map(L =>
    `<img class="lay ${L.fit === 'free' ? 'free' : 'fill'}" src="${esc(imgUrl(L.src, 1600))}" alt="" style="${layerStyle(L)}" draggable="false">`).join('')}</div>`;
}

/* ─── 자리 옮기기 ───
   로고·벽 문양처럼 자리가 정해진 그림을 자리마다 따로 옮긴다. site.positions[자리] = { dx, dy, s, r } (px, 배율, 도) */
const POS_LABELS = { 'logo.home': '왼쪽 위 로고', 'logo.intro': '첫 화면 로고', 'logo.drawer': '목차 로고', 'logo.footer': '맨 아래 로고', crest: '벽 문양' };
function posTransform(key) {
  const p = Data.site?.positions?.[key];
  if (!p) return '';
  const n = (v, d) => (Number.isFinite(+v) ? +v : d);
  return `translate(${n(p.dx, 0)}px, ${n(p.dy, 0)}px) rotate(${n(p.r, 0)}deg) scale(${n(p.s, 1)})`;
}
function applyPositions(root = document) {
  $$('[data-pos]', root).forEach(el => { el.style.transform = posTransform(el.dataset.pos); });
}
