import { Lang } from './models';

/** Every string in the station. VN is primary — design for longer strings than EN. */
export interface Strings {
  brandTag: string;
  idleTitle: string;
  idleSub: string;
  idleCam: string;
  /** Labels around the event details under the idle poster. */
  whenLabel: string;
  whereLabel: string;
  startSorted: string;
  startSortedSub: string;
  startQuick: string;
  startQuickSub: string;
  help: string;
  back: string;
  exit: string;
  endSession: string;
  /** Login chooser — the three ways in. */
  loginTitle: string;
  loginSub: string;
  optFaceId: string;
  optFaceIdSub: string;
  optPhone: string;
  optPhoneSub: string;
  optRegister: string;
  optRegisterSub: string;
  /** Face ID screen. */
  faceIdEyebrow: string;
  faceIdTitle: string;
  holdPose: string;
  cantFaceQ: string;
  stillCantQ: string;
  /** Phone screen. */
  phoneEyebrow: string;
  phoneTitle: string;
  cantPhoneQ: string;
  useFaceId: string;
  okKey: string;
  endTitle: string;
  endBody: string;
  endConfirm: string;
  keepGoing: string;
  cantScan: string;
  registerFirst: string;
  skip: string;
  noFaceLink: string;
  noFaceTitle: string;
  nfFirst: string;
  nfRetry: string;
  nfPhone: string;
  skipNote: string;
  scanning: string;
  notRecognized: string;
  confirmedHi: string;
  confirmedQ: string;
  yes: string;
  notMe: string;
  viewProfile: string;
  edit: string;
  save: string;
  totalContrib: string;
  sessionsWord: string;
  memberSince: string;
  histTitle: string;
  histEmpty: string;
  unknownTitle: string;
  unknownSub: string;
  continueAnon: string;
  downloadApp: string;
  registerHere: string;
  secMain: string;
  secFace: string;
  faceOptional: string;
  fFullName: string;
  fPhone: string;
  fAge: string;
  fCitizenId: string;
  fAddress: string;
  fCity: string;
  fWard: string;
  fStreet: string;
  phFullName: string;
  optional: string;
  requiredNote: string;
  faceWhy: string;
  faceGuide: string;
  capturePhoto: string;
  faceDone: string;
  setupFace: string;
  updateFace: string;
  faceSetupTitle: string;
  faceSaving: string;
  faceSaveFailed: string;
  retake: string;
  cancel: string;
  registerCta: string;
  registering: string;
  registerFailed: string;
  photosNoFace: string;
  pickTitle: string;
  pickSub: string;
  cat_nhua: string;
  cat_giay: string;
  cat_kimloai: string;
  cat_thuytinh: string;
  cat_vai: string;
  cat_chua: string;
  weighing: string;
  settling: string;
  holdStill: string;
  added: string;
  reweigh: string;
  weighAnother: string;
  finish: string;
  scaleLinked: string;
  scaleWaiting: string;
  putOnScale: string;
  sessionList: string;
  total: string;
  empty: string;
  guest: string;
  noPhone: string;
  summaryThanks: string;
  savedFor: string;
  savedAnon: string;
  sessionTotal: string;
  personalTotal: string;
  communityTotal: string;
  thisVisit: string;
  joinNote: string;
  appPointer: string;
  done: string;
  helpTitle: string;
  helpSub: string;
  helpCall: string;
  helpClose: string;
  helpCalledTitle: string;
  helpCalledSub: string;
  dismiss: string;
  keypadTitle: string;
  keypadSub: string;
  lookup: string;
  searching: string;
  notFound: string;
  /** The lookup couldn't reach the server — not the same as "no such account". */
  lookupOffline: string;
  callStaff: string;
  errScaleTitle: string;
  errScaleSub: string;
  errNetworkTitle: string;
  errNetworkSub: string;
  errCameraTitle: string;
  errCameraSub: string;
  /** Shown when permission was refused rather than the camera being absent. */
  errCameraDeniedSub: string;
  errCameraRetry: string;
}

export const STRINGS: Record<Lang, Strings> = {
  vn: {
    brandTag: 'Trạm thu gom tái chế cộng đồng',
    idleTitle: 'Mang rác tái chế đến, cùng cân nhé',
    idleSub: 'Cân từng loại và ghi vào tài khoản của bạn. Miễn phí — vì đường phố sạch hơn.',
    idleCam: 'Camera chỉ dùng để nhận diện khi bạn bắt đầu.',
    whenLabel: 'Thời gian',
    whereLabel: 'Địa điểm',
    startSorted: 'Cân theo loại',
    startSortedSub: 'Phân loại rác và cân từng loại một',
    startQuick: 'Cân nhanh',
    startQuickSub: 'Cả túi rác chưa phân loại, cân một lần',
    help: 'Cần trợ giúp?',
    back: 'Quay lại',
    exit: 'Thoát',
    endSession: 'Kết thúc',
    loginTitle: 'Chọn hình thức đăng nhập',
    loginSub: 'Gomer vui lòng chọn hình thức đăng nhập để cân rác nhé!',
    optFaceId: 'Face ID',
    optFaceIdSub: 'Sử dụng nhận diện khuôn mặt để đăng nhập',
    optPhone: 'Số điện thoại',
    optPhoneSub: 'Sử dụng số điện thoại để đăng nhập',
    optRegister: 'Tạo tài khoản mới',
    optRegisterSub: 'Bạn chưa có tài khoản? Tạo ngay!',
    faceIdEyebrow: 'Đăng nhập Face ID',
    faceIdTitle: 'Vui lòng nhìn vào camera',
    holdPose: '(Giữ nguyên tư thế trong 2 giây)',
    cantFaceQ: 'Không thể nhận diện khuôn mặt?',
    stillCantQ: 'Vẫn không thể đăng nhập?',
    phoneEyebrow: 'Đăng nhập bằng số điện thoại',
    phoneTitle: 'Hãy nhập số điện thoại của bạn',
    cantPhoneQ: 'Không thể nhập số điện thoại?',
    useFaceId: 'Nhận diện bằng Face ID',
    okKey: 'OK',
    endTitle: 'Kết thúc phiên này?',
    endBody: 'Bạn sẽ quay lại màn hình đầu. Mọi thông tin chưa lưu sẽ bị bỏ.',
    endConfirm: 'Kết thúc',
    keepGoing: 'Tiếp tục',
    cantScan: 'Nhập số điện thoại',
    registerFirst: 'Tạo tài khoản mới',
    skip: 'Bỏ qua, cân ẩn danh',
    noFaceLink: 'Camera không nhận ra bạn?',
    noFaceTitle:
      'Nhận diện khuôn mặt không thành công. Bạn đã từng đăng ký tài khoản tại TAGOM chưa?',
    nfFirst: 'Chưa, đây là lần đầu',
    nfRetry: 'Đã có, thử lại lần nữa',
    nfPhone: 'Đã có, nhập số điện thoại cho dễ',
    skipNote: 'Bạn vẫn cân được bình thường — chỉ là không lưu vào tài khoản.',
    scanning: 'Đang tìm…',
    notRecognized: 'Chưa nhận ra khuôn mặt',
    confirmedHi: 'Chào bạn,',
    confirmedQ: 'Đúng là bạn chứ?',
    yes: 'Đúng rồi',
    notMe: 'Không phải tôi',
    viewProfile: 'Xem hồ sơ của tôi',
    edit: 'Chỉnh sửa',
    save: 'Lưu',
    totalContrib: 'Tổng đã đóng góp',
    sessionsWord: 'lần cân',
    memberSince: 'Thành viên từ',
    histTitle: 'Lịch sử cân',
    histEmpty: 'Chưa có lần cân nào được lưu.',
    unknownTitle: 'Chào mừng bạn ghé trạm lần đầu!',
    unknownSub:
      'Tải ứng dụng Tagom để lưu lại đóng góp của bạn theo thời gian. Không bắt buộc.',
    continueAnon: 'Tiếp tục không cần tài khoản',
    downloadApp: 'Quét để tải ứng dụng',
    registerHere: 'Đăng ký tại đây',
    secMain: 'Thông tin chính',
    secFace: 'Dữ liệu khuôn mặt',
    faceOptional: 'Không bắt buộc — rất khuyến khích',
    fFullName: 'Họ và tên',
    fPhone: 'Số điện thoại',
    fAge: 'Tuổi',
    fCitizenId: 'Căn cước công dân',
    fAddress: 'Địa chỉ',
    fCity: 'Tỉnh/Thành phố',
    fWard: 'Phường/Xã',
    fStreet: 'Số nhà, tên đường',
    phFullName: 'Nguyễn Văn A',
    optional: '(tùy chọn)',
    requiredNote: 'Trường bắt buộc',
    faceWhy: 'Để trạm nhận ra bạn bằng khuôn mặt trong lần sau — bạn sẽ không cần nhập số điện thoại.',
    faceGuide: 'Đưa khuôn mặt vào trong khung',
    capturePhoto: 'Chụp ảnh',
    faceDone: 'Đã đủ 5 ảnh khuôn mặt',
    setupFace: 'Thêm khuôn mặt',
    updateFace: 'Cập nhật khuôn mặt',
    faceSetupTitle: 'Chụp khuôn mặt để lần sau quét nhanh hơn',
    faceSaving: 'Đang lưu…',
    faceSaveFailed: 'Không lưu được ảnh, thử lại',
    retake: 'Chụp lại',
    cancel: 'Hủy',
    registerCta: 'Đăng ký',
    registering: 'Đang lưu…',
    registerFailed: 'Chưa lưu được. Vui lòng thử lại hoặc gọi nhân viên.',
    photosNoFace: 'Ảnh chưa thấy rõ khuôn mặt. Vui lòng chụp lại 5 ảnh, nhìn thẳng vào camera.',
    pickTitle: 'Bạn muốn cân loại nào?',
    pickSub: 'Chạm vào một loại để bắt đầu cân',
    cat_nhua: 'Nhựa',
    cat_giay: 'Giấy',
    cat_kimloai: 'Kim loại',
    cat_thuytinh: 'Thủy tinh',
    cat_vai: 'Vải',
    cat_chua: 'Rác tổng hợp',
    weighing: 'Đang cân',
    settling: 'Đang ổn định…',
    holdStill: 'Giữ yên vật trên cân',
    added: 'Đã ghi',
    reweigh: 'Cân lại',
    weighAnother: 'Cân loại khác',
    finish: 'Xong',
    scaleLinked: 'Đã kết nối cân',
    scaleWaiting: 'Đang kết nối cân…',
    putOnScale: 'Đặt vật lên cân',
    sessionList: 'Phiên hiện tại',
    total: 'Tổng',
    empty: 'Chưa có món nào.\nChọn một loại để bắt đầu.',
    guest: 'Khách',
    noPhone: 'Ẩn danh',
    summaryThanks: 'Cảm ơn bạn!',
    savedFor: 'Đã lưu cho',
    savedAnon: 'Phiên ẩn danh — không lưu vào tài khoản',
    sessionTotal: 'Phiên này',
    personalTotal: 'Bạn đã góp',
    communityTotal: 'Cả trạm đã gom',
    thisVisit: 'lần này',
    joinNote: 'Mỗi cân của bạn cộng vào con số chung của cả cộng đồng.',
    appPointer: 'Xem lịch sử đầy đủ trong ứng dụng Tagom trên điện thoại.',
    done: 'Hoàn tất',
    helpTitle: 'Cần nhân viên hỗ trợ?',
    helpSub: 'Nhấn nút bên dưới, nhân viên sẽ đến ngay với bạn.',
    helpCall: 'Gọi nhân viên đến',
    helpClose: 'Tôi tự làm được',
    helpCalledTitle: 'Đã báo nhân viên',
    helpCalledSub: 'Vui lòng đợi một chút, nhân viên đang đến.',
    dismiss: 'Đóng',
    keypadTitle: 'Nhập số điện thoại',
    keypadSub: 'Chúng tôi sẽ tìm tài khoản của bạn.',
    lookup: 'Tìm',
    searching: 'Đang tìm…',
    notFound: 'Không tìm thấy tài khoản với số này.',
    lookupOffline: 'Chưa kết nối được với hệ thống. Vui lòng thử lại hoặc gọi nhân viên.',
    callStaff: 'Gọi nhân viên',
    errScaleTitle: 'Mất kết nối với cân',
    errScaleSub: 'Cân chưa phản hồi. Vui lòng gọi nhân viên hỗ trợ.',
    errNetworkTitle: 'Đang ngoại tuyến',
    errNetworkSub:
      'Vẫn cân được bình thường — dữ liệu sẽ tự lưu khi có mạng trở lại.',
    errCameraTitle: 'Camera không khả dụng',
    errCameraSub: 'Bạn vẫn có thể nhập số điện thoại hoặc bỏ qua để cân ẩn danh.',
    errCameraDeniedSub:
      'Trình duyệt đang chặn camera. Bạn vẫn có thể nhập số điện thoại, hoặc cho phép camera rồi thử lại.',
    errCameraRetry: 'Thử lại camera',
  },
  en: {
    brandTag: 'Community recycling collection station',
    idleTitle: 'Bring your recycling — let’s weigh it',
    idleSub: 'Weigh each type and log it to your account. Free — for cleaner streets.',
    idleCam: 'The camera is only used to recognise you at the start.',
    whenLabel: 'When',
    whereLabel: 'Where',
    startSorted: 'Weigh by type',
    startSortedSub: 'Sort your recycling and weigh each type',
    startQuick: 'Quick weigh',
    startQuickSub: 'One mixed bag, weighed in one go',
    help: 'Need help?',
    back: 'Back',
    exit: 'Exit',
    endSession: 'End',
    loginTitle: 'How would you like to sign in?',
    loginSub: 'Pick a way to sign in, then we can weigh your recycling.',
    optFaceId: 'Face ID',
    optFaceIdSub: 'Sign in by letting the station recognise your face',
    optPhone: 'Phone number',
    optPhoneSub: 'Sign in with your phone number',
    optRegister: 'Create an account',
    optRegisterSub: 'No account yet? Make one now!',
    faceIdEyebrow: 'Face ID sign-in',
    faceIdTitle: 'Please look at the camera',
    holdPose: '(Hold still for 2 seconds)',
    cantFaceQ: "Camera can't recognise you?",
    stillCantQ: 'Still cannot sign in?',
    phoneEyebrow: 'Phone number sign-in',
    phoneTitle: 'Enter your phone number',
    cantPhoneQ: "Can't enter your phone number?",
    useFaceId: 'Recognise me by Face ID',
    okKey: 'OK',
    endTitle: 'End this session?',
    endBody: "You'll return to the start screen. Anything not saved will be discarded.",
    endConfirm: 'End session',
    keepGoing: 'Keep going',
    cantScan: 'Enter phone number',
    registerFirst: 'Create an account',
    skip: 'Skip, weigh anonymously',
    noFaceLink: 'Camera not recognising you?',
    noFaceTitle: 'We couldn’t recognise your face. Have you registered a TAGOM account before?',
    nfFirst: 'No, this is my first time',
    nfRetry: 'Yes — try scanning again',
    nfPhone: 'Yes — enter my phone number instead',
    skipNote: 'You can still weigh as normal — it just won’t save to an account.',
    scanning: 'Looking…',
    notRecognized: 'Face not recognised',
    confirmedHi: 'Hello,',
    confirmedQ: 'Is this you?',
    yes: 'Yes, that’s me',
    notMe: 'Not me',
    viewProfile: 'View my profile',
    edit: 'Edit',
    save: 'Save',
    totalContrib: 'Total contributed',
    sessionsWord: 'sessions',
    memberSince: 'Member since',
    histTitle: 'Weigh history',
    histEmpty: 'No saved sessions yet.',
    unknownTitle: 'Welcome — first time here!',
    unknownSub:
      'Download the Tagom app to keep track of your contribution over time. Optional.',
    continueAnon: 'Continue without an account',
    downloadApp: 'Scan to download the app',
    registerHere: 'Register here',
    secMain: 'Main information',
    secFace: 'Facial data',
    faceOptional: 'Optional — highly recommended',
    fFullName: 'Full name',
    fPhone: 'Phone number',
    fAge: 'Age',
    fCitizenId: 'Citizen ID',
    fAddress: 'Address',
    fCity: 'City / Province',
    fWard: 'Ward',
    fStreet: 'Street address',
    phFullName: 'e.g. Jane Doe',
    optional: '(optional)',
    requiredNote: 'Required field',
    faceWhy: 'Lets the station recognise you by face next time — no need to enter your phone number.',
    faceGuide: 'Position your face in the frame',
    capturePhoto: 'Capture photo',
    faceDone: 'All 5 face photos captured',
    setupFace: 'Set up face',
    updateFace: 'Update face photos',
    faceSetupTitle: 'Take face photos for faster check-in next time',
    faceSaving: 'Saving…',
    faceSaveFailed: "Couldn't save photos, try again",
    retake: 'Retake',
    cancel: 'Cancel',
    registerCta: 'Register',
    registering: 'Saving…',
    registerFailed: 'Couldn’t save. Please try again or call a staff member.',
    photosNoFace: 'Those photos didn’t show a clear face. Please retake the 5 photos, looking straight at the camera.',
    pickTitle: 'What would you like to weigh?',
    pickSub: 'Tap a type to start weighing',
    cat_nhua: 'Plastic',
    cat_giay: 'Paper',
    cat_kimloai: 'Metal',
    cat_thuytinh: 'Glass',
    cat_vai: 'Fabric',
    cat_chua: 'Mixed waste',
    weighing: 'Weighing',
    settling: 'Settling…',
    holdStill: 'Keep it still on the scale',
    added: 'Recorded',
    reweigh: 'Weigh again',
    weighAnother: 'Weigh another',
    finish: 'Done',
    scaleLinked: 'Scale connected',
    scaleWaiting: 'Connecting to the scale…',
    putOnScale: 'Place your items on the scale',
    sessionList: 'This session',
    total: 'Total',
    empty: 'Nothing yet.\nPick a type to begin.',
    guest: 'Guest',
    noPhone: 'Anonymous',
    summaryThanks: 'Thank you!',
    savedFor: 'Saved for',
    savedAnon: 'Anonymous session — not saved to an account',
    sessionTotal: 'This visit',
    personalTotal: 'You’ve brought',
    communityTotal: 'This station has gathered',
    thisVisit: 'this visit',
    joinNote: 'Every weigh you add joins the whole community’s total.',
    appPointer: 'See your full history in the Tagom app on your phone.',
    done: 'Finish',
    helpTitle: 'Need a staff member?',
    helpSub: 'Tap below and someone will come right over to help you.',
    helpCall: 'Call staff over',
    helpClose: 'I’m okay, thanks',
    helpCalledTitle: 'Staff notified',
    helpCalledSub: 'Please wait a moment — someone is on their way.',
    dismiss: 'Close',
    keypadTitle: 'Enter phone number',
    keypadSub: 'We’ll look up your account.',
    lookup: 'Find',
    searching: 'Looking…',
    notFound: 'No account found for that number.',
    lookupOffline: "Couldn't reach the system. Please try again or call a staff member.",
    callStaff: 'Call staff',
    errScaleTitle: 'Lost connection to the scale',
    errScaleSub: 'The scale isn’t responding. Please call a staff member.',
    errNetworkTitle: 'You’re offline',
    errNetworkSub:
      'Weighing still works — your data will save automatically when the connection returns.',
    errCameraTitle: 'Camera unavailable',
    errCameraSub: 'You can still enter a phone number or skip to weigh anonymously.',
    errCameraDeniedSub:
      'The browser is blocking the camera. You can still enter a phone number, or allow the camera and try again.',
    errCameraRetry: 'Try camera again',
  },
};
