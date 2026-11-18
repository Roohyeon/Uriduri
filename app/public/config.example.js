// 이 파일을 복사해서 같은 폴더에 config.js로 저장하고 값을 채우세요. config.js는 git에 올라가지 않습니다.
// 여기에는 "공개용 키"만 넣습니다. 비밀 키(service_role 등)는 절대 넣지 마세요.
// Vite의 public/ 폴더라서 개발 서버와 배포 주소에서 /config.js 로 그대로 제공됩니다.
window.APP_CONFIG = {
  SUPABASE_URL: '',      // Supabase > Project Settings > Data API > Project URL
  SUPABASE_ANON_KEY: '', // Supabase > Project Settings > API Keys > anon public (또는 publishable) 키
};
// 카카오·구글 로그인 키는 여기 넣지 않습니다. Supabase 관리 화면(Authentication > Providers)에 넣습니다.
