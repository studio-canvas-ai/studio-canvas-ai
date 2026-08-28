/**
 * Screen 26 / print wizard 「예시」 dropdown — 150 AI background presets.
 * UI label (Korean + hint in parentheses) maps to English prompt for bgKeyword.
 */

export type BgExampleCategoryId =
  | "traditional"
  | "nature"
  | "minimal"
  | "luxury"
  | "studio";

export type BgExamplePreset = {
  id: string;
  /** UI button label, e.g. "내추럴 한지 파이버 (전통 한지 질감)" */
  labelKo: string;
  /** English prompt appended to AI background input */
  promptEn: string;
};

export type BgExampleCategory = {
  id: BgExampleCategoryId;
  labelKo: string;
  presets: readonly BgExamplePreset[];
};

const p = (
  id: string,
  title: string,
  hint: string,
  promptEn: string
): BgExamplePreset => ({
  id,
  labelKo: `${title} (${hint})`,
  promptEn,
});

export const BG_EXAMPLE_CATEGORIES: readonly BgExampleCategory[] = [
  {
    id: "traditional",
    labelKo: "전통",
    presets: [
      p(
        "trad-hanji-fiber",
        "내추럴 한지 파이버",
        "전통 한지 질감",
        "Traditional Korean handmade hanji paper texture, subtle organic fibers"
      ),
      p(
        "trad-silk-damask",
        "오리엔탈 실크 다마스크",
        "고급 동양 실크",
        "Oriental silk damask pattern, luxurious East Asian textile sheen"
      ),
      p(
        "trad-hanok-wood",
        "전통 한옥 마루 우드",
        "고풍스러운 목재 마루",
        "Traditional Korean hanok wooden floor, warm aged wood grain"
      ),
      p(
        "trad-ink-watercolor",
        "수묵 여백 워터컬러",
        "은은한 한국화 수묵",
        "Korean ink wash watercolor background, soft negative space, muted tones"
      ),
      p(
        "trad-palace-stone",
        "왕실 궁궐 스톤월",
        "품격 있는 궁궐 돌담",
        "Royal palace stone wall texture, dignified Korean architectural masonry"
      ),
      p(
        "trad-gold-screen",
        "골드 리프 병풍",
        "화려한 금박 전통 병풍",
        "Gold leaf traditional Korean folding screen, ornate gilded panels"
      ),
      p(
        "trad-celadon-crackle",
        "청자 그린 크래클",
        "고려청자 크랙 질감",
        "Korean celadon green crackle glaze texture, subtle ceramic craquelure"
      ),
      p(
        "trad-dancheong",
        "단청 지오메트릭",
        "한국 전통 단청 패턴",
        "Traditional Korean dancheong geometric pattern, vivid architectural colors"
      ),
      p(
        "trad-calligraphy",
        "빈티지 캘리그라피",
        "은은한 전통 붓글씨 톤",
        "Vintage Korean calligraphy tone, soft brush ink atmosphere"
      ),
      p(
        "trad-lacquer-red",
        "전통 래커웨어 레드",
        "고급 붉은색 칠기 질감",
        "Traditional red lacquerware texture, deep glossy crimson finish"
      ),
      p(
        "trad-tile-roof",
        "한옥 기와 루프",
        "전통 기와 지붕 결",
        "Korean hanok tile roof pattern, curved ceramic tiles rhythm"
      ),
      p(
        "trad-lattice-window",
        "허니 토운드 격자창",
        "따뜻한 전통 창호살",
        "Warm honey-toned traditional Korean lattice window, wooden muntins"
      ),
      p(
        "trad-silk-cloud",
        "실크 클라우드 모티브",
        "구름 무늬 전통 직물",
        "Silk cloud motif textile, traditional East Asian fabric pattern"
      ),
      p(
        "trad-moss-pagoda",
        "모스 스톤 파고다",
        "이끼 낀 전통 석탑",
        "Moss-covered stone pagoda atmosphere, serene heritage stonework"
      ),
      p(
        "trad-norigae-tassel",
        "노리개 실크 태슬",
        "전통 노리개 장식 감성",
        "Traditional norigae silk tassel aesthetic, elegant Korean ornament mood"
      ),
      p(
        "trad-terracotta",
        "어시 테라코타 포터리",
        "투박한 전통 토기 질감",
        "Earthy terracotta pottery texture, rustic traditional ceramic surface"
      ),
      p(
        "trad-ink-bamboo",
        "잉크 워시 뱀부",
        "대나무 수묵화 배경",
        "Ink wash bamboo painting background, minimalist brush strokes"
      ),
      p(
        "trad-indigo-linen",
        "딥 인디고 내추럴 넨",
        "쪽빛 천연염색 천",
        "Deep indigo natural dyed linen, traditional Korean fabric tone"
      ),
      p(
        "trad-hanji-lantern",
        "한지 등롱 웜글로우",
        "은은한 한지 등불 빛",
        "Hanji paper lantern warm glow, soft ambient traditional light"
      ),
      p(
        "trad-screen-door",
        "전통 창호 스크린",
        "한지 미닫이 문살 배경",
        "Traditional Korean paper screen door, hanji sliding panel lattice"
      ),
      p(
        "trad-palace-red",
        "궁궐 레드 필러",
        "전통 궁궐 붉은 기둥",
        "Palace red pillar background, traditional royal architectural crimson"
      ),
      p(
        "trad-scroll",
        "오리엔탈 스크롤",
        "고풍스러운 동양 두루마리",
        "Oriental scroll backdrop, antique East Asian manuscript atmosphere"
      ),
      p(
        "trad-mother-of-pearl",
        "나전칠기 자개 쉬머",
        "영롱한 자개 빛깔 질감",
        "Korean najeonchilgi mother-of-pearl shimmer, iridescent lacquer inlay"
      ),
      p(
        "trad-golden-pavilion",
        "골든 리즈 파빌리온",
        "갈대가 있는 전통 정자",
        "Golden reeds traditional pavilion scene, serene waterside gazebo"
      ),
      p(
        "trad-bojagi-silk",
        "전통 보자기 실크",
        "고급스러운 전통 보자기",
        "Traditional bojagi silk wrapping cloth, elegant patchwork textile"
      ),
      p(
        "trad-wood-chest",
        "앤틱 우드 체스트",
        "고풍스러운 전통 가구",
        "Antique wooden chest texture, vintage Korean furniture grain"
      ),
      p(
        "trad-white-porcelain",
        "화이트 포셀린 쉬머",
        "빛나는 백자 도자기 질감",
        "White porcelain shimmer, luminous Korean baekja ceramic texture"
      ),
      p(
        "trad-landscape",
        "오리엔탈 랜드스케이프",
        "동양화 풍경화 그라데이션",
        "Oriental landscape painting gradient, misty mountain watercolor wash"
      ),
      p(
        "trad-straw-roof",
        "초가집 스트로우 루프",
        "정겨운 초가집 지붕",
        "Thatched straw roof cottage texture, cozy rural Korean homestead"
      ),
      p(
        "trad-mask-dance",
        "마스크 댄스 스테이지",
        "탈춤 공연장 전통 무대",
        "Traditional mask dance stage, Korean talchum performance backdrop"
      ),
    ],
  },
  {
    id: "nature",
    labelKo: "자연",
    presets: [
      p(
        "nat-forest-bokeh",
        "포레스트 선라이트 보케",
        "숲속 햇살과 몽환적 빛망울",
        "Forest sunlight bokeh, dreamy dappled light through trees"
      ),
      p(
        "nat-golden-hour",
        "골든 아워 스카이",
        "황금빛 노을 하늘 감성",
        "Golden hour sky gradient, warm sunset atmospheric glow"
      ),
      p(
        "nat-morning-mist",
        "모닝 미스트 레이크",
        "고요한 호수의 아침 안개",
        "Morning mist over calm lake, serene foggy water reflection"
      ),
      p(
        "nat-cherry-blossom",
        "체리 블로섬 블러",
        "화사한 벚꽃 아웃포커싱",
        "Cherry blossom soft blur, pastel pink spring bokeh"
      ),
      p(
        "nat-golden-rays",
        "골든 레이즈 헤이즈",
        "아침 햇살의 아스라한 빛줄기",
        "Golden sun rays through haze, ethereal morning light beams"
      ),
      p(
        "nat-palm-shadow",
        "팜 리프 섀도우 월",
        "초록 야자잎 그림자 벽면",
        "Palm leaf shadow wall, tropical green silhouette pattern"
      ),
      p(
        "nat-ocean-wave",
        "스파클링 오션 웨이브",
        "햇살 비치는 푸른 바다 물결",
        "Sparkling ocean wave, sunlit turquoise sea shimmer"
      ),
      p(
        "nat-dandelion",
        "포유 드림 가든",
        "바람에 날리는 민들레 씨앗",
        "Dandelion seeds floating in breeze, dreamy meadow garden"
      ),
      p(
        "nat-autumn-maple",
        "오텀 메이플 선셋",
        "가을 단풍과 노을빛 풍경",
        "Autumn maple sunset, fiery fall foliage warm horizon"
      ),
      p(
        "nat-lavender",
        "프로방스 라벤더",
        "보랏빛 라벤더 들판 정취",
        "Provence lavender field, soft purple floral landscape"
      ),
      p(
        "nat-morning-dew",
        "모닝 듀 그래스",
        "싱그러운 아침 이슬 풀잎",
        "Morning dew on fresh grass, crisp green macro sparkle"
      ),
      p(
        "nat-wheat-field",
        "선키스드 위트 필드",
        "햇살 가득한 황금빛 밀밭",
        "Sun-kissed golden wheat field, warm harvest sunlight"
      ),
      p(
        "nat-open-sky",
        "오픈 스카이 클라우드",
        "청명한 하늘 하얀 구름",
        "Open sky with white clouds, clear blue atmospheric backdrop"
      ),
      p(
        "nat-twilight",
        "미스틱 트와일라이트",
        "신비로운 초저녁 황혼 빛",
        "Mystic twilight glow, mysterious dusk purple horizon"
      ),
      p(
        "nat-sunflower",
        "서머 선플라워",
        "활기찬 여름 해바라기 밭",
        "Summer sunflower field, vibrant yellow floral panorama"
      ),
      p(
        "nat-river-pebbles",
        "클리어 리버 페블스",
        "맑은 계곡물과 매끈한 조약돌",
        "Clear river with smooth pebbles, crystal stream bed texture"
      ),
      p(
        "nat-hydrangea",
        "화이트 하이드란지아",
        "순백의 수국 꽃밭 보케",
        "White hydrangea garden bokeh, pure floral soft focus"
      ),
      p(
        "nat-blue-hour-forest",
        "블루 아워 포레스트",
        "푸른 새벽빛의 고요한 숲",
        "Blue hour forest, tranquil dawn teal woodland atmosphere"
      ),
      p(
        "nat-sandy-beach",
        "코스탈 샌디 비치",
        "따스한 해변 모래사장 물결",
        "Coastal sandy beach, warm rippled sand shoreline"
      ),
      p(
        "nat-lotus-pond",
        "핑크 로터스 폰드",
        "연못 위의 우아한 연꽃",
        "Pink lotus pond, elegant floating flowers on still water"
      ),
      p(
        "nat-ginkgo",
        "오텀 골든 깅코",
        "가을 은행나무 노란 숲길",
        "Autumn golden ginkgo avenue, yellow leaf canopy path"
      ),
      p(
        "nat-lemon-branch",
        "프레시 레몬 브랜치",
        "상큼한 레몬 나무 가지",
        "Fresh lemon tree branch, bright citrus green foliage"
      ),
      p(
        "nat-winter-snow",
        "윈터 모닝 스노우",
        "눈 쌓인 겨울 아침 숲",
        "Winter morning snow forest, soft white frosted trees"
      ),
      p(
        "nat-fairy-moss",
        "페어리테일 모스",
        "동화 같은 초록빛 이끼 질감",
        "Fairytale green moss texture, enchanted forest floor"
      ),
      p(
        "nat-orange-horizon",
        "오렌지 핑크 호라이즌",
        "오렌지빛 바다 수평선",
        "Orange pink ocean horizon, warm coastal sunset line"
      ),
      p(
        "nat-sunbeam-feather",
        "골든 선빔 페더",
        "따스한 햇살 속 하얀 깃털",
        "Golden sunbeam with white feather, warm ethereal light"
      ),
      p(
        "nat-rose-garden",
        "로맨틱 가든 로즈",
        "사랑스러운 붉은 장미 정원",
        "Romantic red rose garden, lush floral romantic backdrop"
      ),
      p(
        "nat-bamboo-beam",
        "뱀부 포레스트 빔",
        "대나무 숲 사이로 드는 빛",
        "Bamboo forest light beams, vertical green grove rays"
      ),
      p(
        "nat-wildflower",
        "와일드플라워 메도우",
        "자연스러운 들꽃 초원",
        "Wildflower meadow, natural colorful prairie blooms"
      ),
      p(
        "nat-milkyway",
        "밀키웨이 네뷸라",
        "신비로운 밤하늘 은하수 성운",
        "Milky Way nebula night sky, mysterious starfield cosmos"
      ),
    ],
  },
  {
    id: "minimal",
    labelKo: "미니멀",
    presets: [
      p(
        "min-pure-white",
        "퓨어 매트 화이트 벽면",
        "가장 깔끔한 순백색 매트 벽",
        "Pure matte white wall, clean seamless studio backdrop"
      ),
      p(
        "min-soft-gray",
        "소프트 그레이시 그렌",
        "은은한 모던 회색 질감",
        "Soft grayish green texture, subtle modern neutral surface"
      ),
      p(
        "min-light-ivory",
        "클린 라이트 아이보리",
        "정갈한 밝은 아이보리 톤",
        "Clean light ivory tone, refined bright neutral background"
      ),
      p(
        "min-beige-linen",
        "뉴트럴 베이지 린넨",
        "차분한 베이지색 린넨 천",
        "Neutral beige linen fabric, calm woven textile texture"
      ),
      p(
        "min-light-concrete",
        "라이트 그레이 콘크리트",
        "도시적인 연회색 콘크리트",
        "Light gray concrete wall, urban minimalist cement surface"
      ),
      p(
        "min-cream-plaster",
        "소프트 크림 플라스터",
        "부드러운 크림빛 미장 벽",
        "Soft cream plaster wall, smooth warm stucco finish"
      ),
      p(
        "min-mint-gradient",
        "민트 화이트 그라데이션",
        "상쾌한 민트화이트 그라데이션",
        "Mint white gradient, fresh airy pastel transition"
      ),
      p(
        "min-ceramic-white",
        "스무스 세라믹 화이트",
        "매끄러운 백자 세라믹 질감",
        "Smooth ceramic white texture, polished porcelain surface"
      ),
      p(
        "min-pale-blue",
        "페일 블루 에어리",
        "공기처럼 가벼운 연푸른빛",
        "Pale blue airy background, lightweight soft sky tone"
      ),
      p(
        "min-warm-gray",
        "웜 그레이 프로페셔널",
        "전문적인 따뜻한 회색 톤",
        "Warm gray professional backdrop, corporate neutral tone"
      ),
      p(
        "min-matte-paper",
        "매트 페이퍼 내추럴",
        "자연스러운 무광 종이 질감",
        "Matte natural paper texture, subtle fiber grain"
      ),
      p(
        "min-arch-shadow",
        "아키텍처럴 섀도우 월",
        "건축적 그림자가 든 벽면",
        "Architectural shadow wall, geometric light and shade pattern"
      ),
      p(
        "min-brushed-silver",
        "실버 메탈릭 브러시드",
        "세련된 은색 금속 브러시",
        "Brushed silver metallic surface, refined steel sheen"
      ),
      p(
        "min-peach-white",
        "피치 화이트 델리케이트",
        "섬세한 복숭아빛 화이트",
        "Peach white delicate tone, soft blush neutral backdrop"
      ),
      p(
        "min-snow-canvas",
        "스노우 화이트 캔버스",
        "눈처럼 하얀 패브릭 캔버스",
        "Snow white fabric canvas, seamless textile studio backdrop"
      ),
      p(
        "min-geometric",
        "지오메트릭 미니멀",
        "은은한 기하학 미니멀 패턴",
        "Geometric minimal pattern, subtle linear abstract design"
      ),
      p(
        "min-pale-lavender",
        "페일 라벤더 스무스",
        "부드러운 연보라 그라데이션",
        "Pale lavender smooth gradient, gentle purple fade"
      ),
      p(
        "min-butter-yellow",
        "버터 옐로우 매트",
        "따스한 버터색 무광 배경",
        "Butter yellow matte background, warm soft pastel tone"
      ),
      p(
        "min-sage-green",
        "세이지 그린 캘름",
        "차분한 세이지 초록빛 톤",
        "Sage green calm tone, muted botanical neutral"
      ),
      p(
        "min-white-marble",
        "화이트 마블 더스트",
        "은은한 흰색 대리석 가루 질감",
        "White marble dust texture, subtle veined stone powder"
      ),
      p(
        "min-alabaster",
        "알래스터 화이트 앰비언트",
        "고급스러운 석고 조명 벽",
        "Alabaster white ambient wall, premium plaster studio light"
      ),
      p(
        "min-cyan-tech",
        "사이안 테크 미니멀",
        "미래지향적 청록빛 미니멀",
        "Cyan tech minimal background, futuristic teal clean design"
      ),
      p(
        "min-neutral-taupe",
        "뉴트럴 토프 일레거트",
        "우아한 뉴트럴 토프 컬러",
        "Neutral taupe elegant tone, sophisticated warm gray-brown"
      ),
      p(
        "min-pearl-satin",
        "펄 화이트 새틴",
        "진주빛 새틴 천의 은은함",
        "Pearl white satin fabric, subtle lustrous textile sheen"
      ),
      p(
        "min-grid-line",
        "미니멀 그리드 라인",
        "깔끔한 격자 선 미니멀 패턴",
        "Minimal grid line pattern, clean technical blueprint aesthetic"
      ),
      p(
        "min-ecru-matte",
        "에크루 오가닉 매트",
        "유기농 무광 에크루 베이지",
        "Ecru organic matte background, natural unbleached cotton tone"
      ),
      p(
        "min-steel-blue",
        "스틸 블루 코퍼레이트",
        "시크한 철제 푸른빛 기업형",
        "Steel blue corporate backdrop, sleek professional cool tone"
      ),
      p(
        "min-rose-quartz",
        "로즈쿼츠 타이디",
        "정돈된 장미수정빛 파스텔",
        "Rose quartz tidy pastel, organized soft pink minimal"
      ),
      p(
        "min-frosted-glass",
        "프로스티드 글래스",
        "불투명 유리빛 은은한 조명",
        "Frosted glass background, diffused translucent soft lighting"
      ),
      p(
        "min-studio-paper",
        "커머셜 스튜디오 페이퍼",
        "광고용 이음새 없는 스튜디오 배경",
        "Commercial seamless studio paper, advertising cyclorama white"
      ),
    ],
  },
  {
    id: "luxury",
    labelKo: "럭셔리",
    presets: [
      p(
        "lux-white-gold-marble",
        "화이트 골드 마블",
        "고급스러운 백금 대리석 결",
        "White gold marble veining, premium platinum stone texture"
      ),
      p(
        "lux-dark-navy",
        "다크 네이비 메탈릭",
        "묵직한 남색의 메탈릭 광택",
        "Dark navy metallic sheen, deep blue luxury gloss surface"
      ),
      p(
        "lux-charcoal-gold",
        "차콜 골드 라이팅",
        "다크 차콜과 황금빛 조명",
        "Charcoal gold lighting, dark gray with warm golden accent glow"
      ),
      p(
        "lux-champagne-silk",
        "샴페인 골드 실크",
        "우아한 샴페인 골드빛 실크",
        "Champagne gold silk drape, elegant lustrous fabric folds"
      ),
      p(
        "lux-emerald-velvet",
        "에메랄드 그린 벨벳",
        "깊이 있는 초록빛 벨벳 천",
        "Emerald green velvet texture, rich deep plush fabric"
      ),
      p(
        "lux-royal-purple",
        "로열 퍼플 골드",
        "왕실의 보라빛과 금박 포인트",
        "Royal purple with gold foil accents, regal luxury palette"
      ),
      p(
        "lux-black-leather",
        "클래식 블랙 레더",
        "묵직하고 고급스러운 가죽 질감",
        "Classic black leather texture, premium supple hide surface"
      ),
      p(
        "lux-rose-gold",
        "로즈 골드 메탈릭",
        "트렌디한 로즈골드 금속 질감",
        "Rose gold metallic texture, trendy copper-pink metal sheen"
      ),
      p(
        "lux-burgundy-velvet",
        "버건디 와인 벨벳",
        "고혹적인 와인빛 벨벳 질감",
        "Burgundy wine velvet, seductive deep red plush fabric"
      ),
      p(
        "lux-obsidian-marble",
        "옵시디언 블랙 마블",
        "검은 대리석 속 금빛 결",
        "Obsidian black marble with gold veins, dramatic dark stone"
      ),
      p(
        "lux-premium-bronze",
        "프리미엄 브론즈",
        "고급스러운 청동빛 그라데이션",
        "Premium bronze gradient, sophisticated warm metal tone"
      ),
      p(
        "lux-midnight-star",
        "미드나이트 블루 스타",
        "밤하늘 반짝이는 별빛 톤",
        "Midnight blue star sparkle, night sky glitter luxury tone"
      ),
      p(
        "lux-walnut-wood",
        "리치 월넛 우드",
        "중후하고 고급스러운 호두나무",
        "Rich walnut wood grain, executive premium timber texture"
      ),
      p(
        "lux-slate-platinum",
        "스레이트 플래티넘",
        "회색 슬레이트와 백금 가루",
        "Slate platinum dust, gray stone with silver metallic flecks"
      ),
      p(
        "lux-taupe-leather",
        "토프 비즈니스 레더",
        "비즈니스 제안서용 고급 가죽",
        "Taupe business leather, executive proposal premium hide"
      ),
      p(
        "lux-imperial-blue",
        "임페리얼 블루 트림",
        "제왕적 푸른빛의 금색 테두리",
        "Imperial blue with gold trim, majestic bordered luxury frame"
      ),
      p(
        "lux-dark-emerald",
        "다크 에메랄드 리크스",
        "어두운 에메랄드 빛샘 효과",
        "Dark emerald light leak, moody green cinematic glow"
      ),
      p(
        "lux-matte-black",
        "매트 블랙 앰비언트",
        "은은한 무광 블랙 간접조명",
        "Matte black ambient lighting, subtle dark luxury atmosphere"
      ),
      p(
        "lux-ivory-gold-foil",
        "아이보리 골드 포일",
        "금박 테두리가 든 아이보리 종이",
        "Ivory paper with gold foil border, elegant stationery texture"
      ),
      p(
        "lux-sapphire-silk",
        "딥 사파이어 실크",
        "깊은 사파이어빛 실크 드레이프",
        "Deep sapphire silk drape, luxurious blue fabric cascade"
      ),
      p(
        "lux-granite-sparkle",
        "다크 그나이트 스파클",
        "반짝이는 크리스탈 화강암",
        "Dark granite crystal sparkle, glittering stone surface"
      ),
      p(
        "lux-copper-brushed",
        "리치 코퍼 브러시드",
        "따스한 구리빛 브러시 메탈",
        "Rich brushed copper metal, warm artisan metallic texture"
      ),
      p(
        "lux-charcoal-felt",
        "차콜 펠트 스레드",
        "회색 펠트에 금속사 혼합 질감",
        "Charcoal felt with metallic thread, textured luxury fabric blend"
      ),
      p(
        "lux-deep-plum",
        "딥 플럼 갈라",
        "파티 행사용 짙은 플럼 그라데이션",
        "Deep plum gala gradient, party event rich purple fade"
      ),
      p(
        "lux-frosted-gold",
        "프로스티드 골드",
        "금속 유리 속 따스한 골드빛",
        "Frosted gold glass, warm golden light through metal glass"
      ),
      p(
        "lux-teal-velvet",
        "다크 틸 벨벳 섀도우",
        "깊은 그림자의 청록색 벨벳",
        "Dark teal velvet shadow, deep cyan plush luxury fabric"
      ),
      p(
        "lux-artdeco",
        "아트데코 블랙골드",
        "클래식한 아트데코 기하학 패턴",
        "Art deco black gold pattern, classic geometric luxury design"
      ),
      p(
        "lux-mahogany",
        "마호가니 이그제큐티브",
        "최고급 중역실 마호가니 목재",
        "Executive mahogany wood, premium boardroom timber grain"
      ),
      p(
        "lux-silver-reflection",
        "실버 슬릭 리플렉션",
        "매끄러운 은빛 반사 그라데이션",
        "Silver slick reflection gradient, polished chrome luxury sheen"
      ),
      p(
        "lux-chandelier-bokeh",
        "볼룸 샹들리에 보케",
        "화려한 연회장 샹들리에 빛망울",
        "Ballroom chandelier bokeh, ornate gala light sparkle"
      ),
    ],
  },
  {
    id: "studio",
    labelKo: "스튜디오",
    presets: [
      p(
        "stu-warm-cinematic",
        "웜 시네마틱 스튜디오",
        "따뜻한 영화 같은 스튜디오 조명",
        "Warm cinematic studio lighting, film-like amber key light"
      ),
      p(
        "stu-soft-coral",
        "소프트 코랄 피치",
        "화사하고 부드러운 코랄빛",
        "Soft coral peach gradient, fresh gentle warm pastel"
      ),
      p(
        "stu-moody-particle",
        "딥 무디 파티클",
        "신비로운 무드와 빛 입자 효과",
        "Deep moody particle light, mysterious atmospheric dust rays"
      ),
      p(
        "stu-cafe-interior",
        "모던 인테리어 카페",
        "따스한 조명의 감성 카페 풍경",
        "Modern cafe interior, warm ambient lifestyle setting"
      ),
      p(
        "stu-trendy-gradient",
        "트렌디 그라데이션",
        "감각적인 트렌디 컬러 메시",
        "Trendy color mesh gradient, contemporary vibrant blend"
      ),
      p(
        "stu-neon-pink-cyan",
        "네온핑크 사이안",
        "사이버틱한 네온 핑크와 청록빛",
        "Neon pink and cyan, cyberpunk electric glow backdrop"
      ),
      p(
        "stu-dramatic-stage",
        "다라마틱 스테이지",
        "무대를 비추는 극적인 스포트라이트",
        "Dramatic stage spotlight, theatrical performance lighting"
      ),
      p(
        "stu-pastel-mint",
        "파스텔 민트 라벤더",
        "몽환적인 민트와 라벤더 조화",
        "Pastel mint lavender blend, dreamy soft color harmony"
      ),
      p(
        "stu-golden-backlight",
        "골든 아워 백라이트",
        "인물/텍스트 살리는 역광 조명",
        "Golden hour backlight, rim light for subject and text pop"
      ),
      p(
        "stu-abstract-3d",
        "앱스트랙트 3D",
        "감각적인 3D 파스텔 조형미",
        "Abstract 3D pastel shapes, sculptural modern render aesthetic"
      ),
      p(
        "stu-dark-neon",
        "다크 블루 네온글로우",
        "어두운 배경 속 네온 빛줄기",
        "Dark blue neon glow streaks, moody electric light trails"
      ),
      p(
        "stu-scandi-bright",
        "스칸디나비안 브라이트",
        "북유럽풍 밝고 화사한 채광",
        "Scandinavian bright daylight, airy Nordic interior glow"
      ),
      p(
        "stu-sunset-magenta",
        "선셋 오렌지 마젠타",
        "석양빛 오렌지와 마젠타 조화",
        "Sunset orange magenta blend, vivid twilight color wash"
      ),
      p(
        "stu-teal-amber",
        "시네마틱 틸앰버",
        "영화 색보정 틸 앤 앰버 톤",
        "Cinematic teal and amber color grade, film look contrast"
      ),
      p(
        "stu-holographic",
        "홀로그래픽 쉬머",
        "영롱하게 빛나는 홀로그램 빛",
        "Holographic shimmer, iridescent rainbow light reflection"
      ),
      p(
        "stu-dark-strip",
        "미니멀 다크 스트립",
        "어두운 배경 속 한 줄기 빛 조명",
        "Minimal dark strip light, single beam on black background"
      ),
      p(
        "stu-cheerful-yellow",
        "체어풀 옐로우민트",
        "상큼하고 활기찬 노랑·민트톤",
        "Cheerful yellow mint tones, vibrant fresh studio palette"
      ),
      p(
        "stu-twilight-urban",
        "트와일라이트 어반",
        "도시 야경의 은은한 보케 감성",
        "Twilight urban bokeh, soft city night lights atmosphere"
      ),
      p(
        "stu-retro-synth",
        "레트로 신스웨이브",
        "레트로 감성의 80년대 네온 격자",
        "Retro synthwave 80s neon grid, vintage cyber horizon"
      ),
      p(
        "stu-ethereal-smoke",
        "에테리얼 스모크",
        "몽환적으로 피어오르는 핑크 연기",
        "Ethereal pink smoke wisps, dreamy floating vapor"
      ),
      p(
        "stu-dark-gold",
        "럭셔리 다크 골드",
        "고급스러운 어두운 배경 금빛 가루",
        "Luxury dark gold dust, premium black background golden particles"
      ),
      p(
        "stu-artistic-lilac",
        "모던 아티스틱 라일락",
        "예술적인 라일락빛 감성 스튜디오",
        "Modern artistic lilac studio, creative purple mood lighting"
      ),
      p(
        "stu-red-curtain",
        "다크 레드 커튼",
        "연극 무대의 묵직한 붉은 커튼",
        "Dark red theater curtain, dramatic stage drape backdrop"
      ),
      p(
        "stu-startup-blue",
        "스타트업 블루테크",
        "IT 테크 느낌의 깔끔한 블루 메시",
        "Startup blue tech mesh, clean modern SaaS gradient"
      ),
      p(
        "stu-fireplace",
        "코지 파이어플레이스",
        "벽난로의 아늑한 주황빛 간접조명",
        "Cozy fireplace ambient glow, warm orange hearth lighting"
      ),
      p(
        "stu-neon-liquid",
        "네온 리퀴드 플로우",
        "트렌디한 액체 형태 네온 그라데이션",
        "Neon liquid flow gradient, trendy fluid abstract neon"
      ),
      p(
        "stu-gallery-spot",
        "갤러리 스포트라이트",
        "미술관 트랙 조명과 은은한 안개",
        "Gallery track spotlight with soft haze, museum exhibition lighting"
      ),
      p(
        "stu-electric-blue",
        "일렉트릭 블루코랄",
        "강렬한 블루와 코랄의 대비 조명",
        "Electric blue coral contrast lighting, bold complementary glow"
      ),
      p(
        "stu-emerald-glow",
        "에메랄드 글로우",
        "영롱한 초록빛 원형 보케 조명",
        "Emerald circular bokeh glow, luminous green orb lights"
      ),
      p(
        "stu-fashion-editorial",
        "하이엔드 패션지",
        "패션 화보 같은 드라마틱한 음영",
        "High-end fashion editorial, dramatic shadow fashion photography mood"
      ),
    ],
  },
] as const;

/** Single-select: set preset prompt with trailing comma-space for continued typing. */
export function applyBgExamplePreset(promptEn: string): string {
  const next = promptEn.trim();
  if (!next) return "";
  return `${next}, `;
}

export function findSelectedBgExamplePreset(
  bgKeyword: string
): BgExamplePreset | null {
  const trimmed = bgKeyword.trimStart();
  if (!trimmed) return null;

  for (const category of BG_EXAMPLE_CATEGORIES) {
    for (const preset of category.presets) {
      const prompt = preset.promptEn;
      if (
        trimmed === prompt ||
        trimmed.startsWith(`${prompt}, `) ||
        trimmed.startsWith(`${prompt},`)
      ) {
        return preset;
      }
    }
  }
  return null;
}

export function isBgExamplePresetSelected(
  bgKeyword: string,
  promptEn: string
): boolean {
  return findSelectedBgExamplePreset(bgKeyword)?.promptEn === promptEn.trim();
}

/** Korean label for the active single-select preset (dropdown value chip). */
export function selectedBgExampleLabel(bgKeyword: string): string | null {
  return findSelectedBgExamplePreset(bgKeyword)?.labelKo ?? null;
}
