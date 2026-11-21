import React, { createContext, useContext, useMemo, useState } from 'react';

const copy = {
  en: {
    lang: 'اردو',
    stay: 'The stay',
    rooms: 'Rooms',
    book: 'Book',
    find: 'Find a booking',
    visit: 'Visit',
    experiences: 'Experiences',
    offers: 'Offers',
    dining: 'Dining',
    journal: 'Journal',
    kicker: 'Katpana Cold Desert · Skardu',
    hero: 'The desert at the door.',
    heroBody: 'Nineteen glass-fronted huts on the Katpana dune, fifteen minutes from Skardu airport. Check in at 2:00 PM, check out by noon.',
    checkIn: 'Check in',
    checkOut: 'Check out',
    adults: 'Adults',
    children: 'Children',
    search: 'Check availability',
    roomsTitle: 'Huts facing the dune',
    from: 'From',
    night: 'per night',
    choose: 'Choose dates',
    storyKicker: 'The house',
    storyTitle: 'Red roofs on the cold desert.',
    storyBody: 'Oasis Resort sits on 165 kanals at Katpana, with the Karakoram rising behind the huts. Breakfast is included, and heaters are warmed before you arrive in winter.',
    dineTitle: 'Dinner on the sand',
    dineBody: 'Wood-fired karahi, valley trout, and hot drinks. Room service posts straight to your room folio.',
    practical: 'Before you arrive',
    policy1: 'Check-in 2:00 PM',
    policy2: 'Check-out 12:00 PM',
    policy3: 'Free cancellation until 48 hours before arrival',
    footer: 'Glass-fronted huts in the Katpana cold desert. Book direct and your room is held in our own book.',
    yourStay: 'Your stay',
    nightsLabel: 'nights',
    available: 'available',
    soldOut: 'Nothing left in this category for those dates.',
    guest: 'Guest details',
    first: 'First name',
    last: 'Last name',
    phone: 'Phone',
    email: 'Email',
    requests: 'Notes for the desk',
    payHotel: 'Pay at the hotel',
    payTransfer: 'Pay by Easypaisa or bank transfer',
    confirm: 'Confirm reservation',
    held: 'Your room is held',
    heldBody: 'Your reservation is recorded at the front desk. Keep your booking number and phone handy.',
    another: 'Look up this booking',
    lookupTitle: 'Find a booking',
    lookupBody: 'Enter the booking number from your confirmation and the phone number on the reservation.',
    bookingNo: 'Booking number',
    lookup: 'Find booking',
    feedback: 'How was your stay?',
    send: 'Submit review',
    visitTitle: 'Come to Katpana',
    address: 'Cold desert, Katpana, Skardu 16100, Gilgit-Baltistan, Pakistan',
  },
  ur: {
    lang: 'English',
    stay: 'قیام',
    rooms: 'کمرے',
    book: 'بکنگ',
    find: 'بکنگ تلاش کریں',
    visit: 'رابطہ',
    experiences: 'تجربے',
    offers: 'آفرز',
    dining: 'کھانا',
    journal: 'جرنل',
    kicker: 'کٹپانہ سرد صحرا · سکردو',
    hero: 'صحرا دروازے پر۔',
    heroBody: 'کٹپانہ کے ٹیلے پر انیس کمرے، سکردو ایئرپورٹ سے پندرہ منٹ۔ چیک اِن دو بجے، روانگی دوپہر بارہ بجے۔',
    checkIn: 'چیک اِن',
    checkOut: 'چیک آؤٹ',
    adults: 'بالغ',
    children: 'بچے',
    search: 'دستیابی دیکھیں',
    roomsTitle: 'ٹیلے کی طرف کمرے',
    from: 'سے',
    night: 'فی رات',
    choose: 'تاریخ منتخب کریں',
    storyKicker: 'مکان',
    storyTitle: 'سرد صحرا پر سرخ چھتیں۔',
    storyBody: 'اویسس ریزورٹ کٹپانہ میں تقریباً ۱۶۵ کنال پر ہے، پیچھے قراقرم۔ ناشتہ شامل ہے، اور سردیوں میں ہیٹر آپ کے آنے سے پہلے چل رہا ہوتا ہے۔',
    dineTitle: 'ریت پر رات کا کھانا',
    dineBody: 'کڑاہی، گرلڈ ٹراؤٹ، اور گرم مشروبات۔ روم سروس براہ راست بل پر چڑھتی ہے۔',
    practical: 'آنے سے پہلے',
    policy1: 'چیک اِن دوپہر ۲ بجے',
    policy2: 'چیک آؤٹ دوپہر ۱۲ بجے',
    policy3: 'آمد سے ۴۸ گھنٹے پہلے تک منسوخی مفت',
    footer: 'کٹپانہ کے سرد صحرا میں شیشے والے کمرے۔ براہ راست بک کریں، کمرہ ہماری اپنی کتاب میں محفوظ ہوتا ہے۔',
    yourStay: 'آپ کا قیام',
    nightsLabel: 'راتیں',
    available: 'دستیاب',
    soldOut: 'ان تاریخوں میں اس قسم کا کمرہ نہیں بچا۔',
    guest: 'مہمان کی تفصیلات',
    first: 'پہلا نام',
    last: 'آخری نام',
    phone: 'فون',
    email: 'ای میل',
    requests: 'ڈیسک کے لیے نوٹ',
    payHotel: 'ادائیگی ہوٹل پر',
    payTransfer: 'ایزی پیسہ یا بینک ٹرانسفر',
    confirm: 'قیام کی تصدیق کریں',
    held: 'کمرہ محفوظ ہو گیا',
    heldBody: 'تصدیق ڈیسک پر درج ہو گئی ہے۔ اپنا بکنگ نمبر اور فون محفوظ رکھیں۔',
    another: 'بکنگ دیکھیں',
    lookupTitle: 'بکنگ تلاش کریں',
    lookupBody: 'تصدیق والا بکنگ نمبر اور ریزرویشن پر درج فون نمبر لکھیں۔',
    bookingNo: 'بکنگ نمبر',
    lookup: 'تلاش کریں',
    feedback: 'آپ کا قیام کیسا رہا؟',
    send: 'بھیجیں',
    visitTitle: 'کٹپانہ آئیے',
    address: 'سرد صحرا، کٹپانہ، سکردو ۱۶۱۰۰، گلگت بلتستان، پاکستان',
  },
};

type Lang = 'en' | 'ur';
interface I18nValue {
  lang: Lang;
  t: typeof copy.en;
  toggle: () => void;
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  t: copy.en,
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem('oasis_lang') === 'ur' ? 'ur' : 'en';
    } catch {
      return 'en';
    }
  });

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: copy[lang] || copy.en,
      toggle: () => {
        const next: Lang = lang === 'en' ? 'ur' : 'en';
        try {
          localStorage.setItem('oasis_lang', next);
        } catch {
          /* ignore */
        }
        setLang(next);
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
