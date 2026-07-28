import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  CarFront,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useApartmentData } from '../data/ApartmentDataProvider';
import { useUiLanguage } from '../i18n';
import { publicUrl } from '../utils/publicUrl';
import { BLISS_GARAGE_77_IMAGE } from '../assets/parkingImages';

type Lang = 'vi' | 'en';

type ParkingPhoto = {
  storagePath: string;
  captionVi: string;
  captionEn: string;
  url?: string;
};

type ParkingGuideData = {
  enabled: boolean;
  statusVi: string;
  statusEn: string;
  locationVi: string;
  locationEn: string;
  accessVi: string;
  accessEn: string;
  spot: string;
  mapUrl: string;
  noteVi: string;
  noteEn: string;
  internalNoteVi: string;
  internalNoteEn: string;
  internalEmailTo: string;
  internalEmailSubject: string;
  internalEmailBody: string;
  instructionsVi: string[];
  instructionsEn: string[];
  messageVi: string;
  messageEn: string;
  photos: ParkingPhoto[];
};

type ParkingRecord = {
  id: string;
  apartment: string;
  parking: ParkingGuideData;
};

type PendingPhoto = {
  file: File;
  captionVi: string;
  captionEn: string;
  previewUrl: string;
};

const BUILTIN_BLISS_PHOTO = 'builtin:bliss-garage-77';
const BUILTIN_BLUE_ENCLAVE_KEY_FOB = 'builtin:blue-enclave-key-fob';
const BUILTIN_BLUE_ENCLAVE_BUILDING = 'builtin:blue-enclave-building';
const BUILTIN_BLUE_ENCLAVE_SPOT_64 = 'builtin:blue-enclave-spot-64';
const BUILTIN_CASINO_ENCLAVE_BUILDING = 'builtin:casino-enclave-building';
const BUILTIN_CASINO_ENCLAVE_KEY_FOB = 'builtin:casino-enclave-key-fob';
const BUILTIN_CASINO_ENCLAVE_LEVEL_2_LIFTS = 'builtin:casino-enclave-level-2-lifts';
const BUILTIN_CASINO_ENCLAVE_SPOT_57 = 'builtin:casino-enclave-spot-57';
const BUILTIN_MILLERS_MANOR_ENTRANCE = 'builtin:millers-manor-barangaroo-point';
const BUILTIN_PANORAMIC_ESCAPE_OVERVIEW = 'builtin:panoramic-escape-overview';
const BUILTIN_PANORAMIC_ESCAPE_SPOT_35 = 'builtin:panoramic-escape-spot-35';
const BUILTIN_GRAND_PYRMONT_PRIVATE_BAY = 'builtin:grand-pyrmont-private-bay';
const BUILTIN_GRAND_PYRMONT_LANE_DIRECTION = 'builtin:grand-pyrmont-lane-direction';
const BUILTIN_GRAND_PYRMONT_COMPLEX_ENTRANCE = 'builtin:grand-pyrmont-complex-entrance';
const BUILTIN_GRAND_PYRMONT_HOUSE_69 = 'builtin:grand-pyrmont-house-69';
const BUILTIN_BAYSIDE_ENCLAVE_SPOT_CLOSE = 'builtin:bayside-enclave-spot-close';
const BUILTIN_BAYSIDE_ENCLAVE_SPOT_WIDE = 'builtin:bayside-enclave-spot-wide';
const BUILTIN_BAYSIDE_ENCLAVE_LEVEL_2_PANORAMA = 'builtin:bayside-enclave-level-2-panorama';
const BUILTIN_BAYSIDE_ENCLAVE_FOB_GATE = 'builtin:bayside-enclave-fob-gate';
const BUILTIN_BAYSIDE_ENCLAVE_HARBOURSIDE_ENTRANCE = 'builtin:bayside-enclave-harbourside-entrance';
const BUILTIN_PHOTO_URLS: Record<string, string> = {
  [BUILTIN_BLISS_PHOTO]: BLISS_GARAGE_77_IMAGE,
  [BUILTIN_BLUE_ENCLAVE_KEY_FOB]: publicUrl('parking/blue-enclave-key-fob.jpg'),
  [BUILTIN_BLUE_ENCLAVE_BUILDING]: publicUrl('parking/blue-enclave-building.jpg'),
  [BUILTIN_BLUE_ENCLAVE_SPOT_64]: publicUrl('parking/blue-enclave-spot-64.jpg'),
  [BUILTIN_CASINO_ENCLAVE_BUILDING]: publicUrl('parking/casino-enclave-building.jpg'),
  [BUILTIN_CASINO_ENCLAVE_KEY_FOB]: publicUrl('parking/casino-enclave-key-fob.jpg'),
  [BUILTIN_CASINO_ENCLAVE_LEVEL_2_LIFTS]: publicUrl('parking/casino-enclave-level-2-lifts.jpg'),
  [BUILTIN_CASINO_ENCLAVE_SPOT_57]: publicUrl('parking/casino-enclave-spot-57.jpg'),
  [BUILTIN_MILLERS_MANOR_ENTRANCE]: publicUrl('parking/millers-manor-barangaroo-point.jpg'),
  [BUILTIN_PANORAMIC_ESCAPE_OVERVIEW]: publicUrl('parking/panoramic-escape-overview.jpg'),
  [BUILTIN_PANORAMIC_ESCAPE_SPOT_35]: publicUrl('parking/panoramic-escape-spot-35.jpg'),
  [BUILTIN_GRAND_PYRMONT_PRIVATE_BAY]: publicUrl('parking/grand-pyrmont-private-bay.jpg'),
  [BUILTIN_GRAND_PYRMONT_LANE_DIRECTION]: publicUrl('parking/grand-pyrmont-lane-direction.jpg'),
  [BUILTIN_GRAND_PYRMONT_COMPLEX_ENTRANCE]: publicUrl('parking/grand-pyrmont-complex-entrance.jpg'),
  [BUILTIN_GRAND_PYRMONT_HOUSE_69]: publicUrl('parking/grand-pyrmont-house-69.jpg'),
  [BUILTIN_BAYSIDE_ENCLAVE_SPOT_CLOSE]: publicUrl('parking/bayside-enclave-spot-close.jpg'),
  [BUILTIN_BAYSIDE_ENCLAVE_SPOT_WIDE]: publicUrl('parking/bayside-enclave-spot-wide.jpg'),
  [BUILTIN_BAYSIDE_ENCLAVE_LEVEL_2_PANORAMA]: publicUrl('parking/bayside-enclave-level-2-panorama.jpg'),
  [BUILTIN_BAYSIDE_ENCLAVE_FOB_GATE]: publicUrl('parking/bayside-enclave-fob-gate.jpg'),
  [BUILTIN_BAYSIDE_ENCLAVE_HARBOURSIDE_ENTRANCE]: publicUrl('parking/bayside-enclave-harbourside-entrance.jpg'),
};
const builtinPhotoUrl = (storagePath: string) => BUILTIN_PHOTO_URLS[storagePath] || '';
const isBuiltinPhoto = (storagePath: string) => Boolean(BUILTIN_PHOTO_URLS[storagePath]);
const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-extrabold transition';
const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const pick = (lang: Lang, vi: string, en: string) => lang === 'vi' ? vi : en;

function emptyParking(): ParkingGuideData {
  return {
    enabled: false,
    statusVi: '',
    statusEn: '',
    locationVi: '',
    locationEn: '',
    accessVi: '',
    accessEn: '',
    spot: '',
    mapUrl: '',
    noteVi: '',
    noteEn: '',
    internalNoteVi: '',
    internalNoteEn: '',
    internalEmailTo: '',
    internalEmailSubject: '',
    internalEmailBody: '',
    instructionsVi: [],
    instructionsEn: [],
    messageVi: '',
    messageEn: '',
    photos: [],
  };
}

function defaultParkingFor(apartment: string): ParkingGuideData | null {
  const normalized = apartment.trim().toLocaleLowerCase();

  if (
    normalized === '55 little mount street - 3br enclave | fish market & casino'
    || normalized.endsWith('3br enclave | fish market & casino')
  ) {
    return {
      enabled: true,
      statusVi: 'Bãi xe trả phí · chủ nhà hoàn lại',
      statusEn: 'Paid parking · reimbursed by host',
      locationVi: 'Bãi xe an toàn gần căn hộ, đi bộ khoảng 3–4 phút',
      locationEn: 'Secure paid car park nearby, about a 3–4 minute walk',
      accessVi: 'Tap & pay hoặc đặt chỗ trước',
      accessEn: 'Tap & pay or pre-book',
      spot: '',
      mapUrl: '',
      noteVi: 'Không có thẻ đậu xe cần nhận. Hãy giữ hóa đơn hoặc xác nhận đặt chỗ để được hoàn lại chi phí.',
      noteEn: 'There is no parking card to collect. Keep the receipt or booking confirmation for reimbursement.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Bãi đậu xe nằm ngoài tòa nhà, cách căn hộ khoảng **3–4 phút đi bộ**.',
        'Khách có thể dùng **tap & pay** hoặc **đặt chỗ trước**.',
        'Giữ lại **hóa đơn hoặc xác nhận đặt chỗ** sau khi thanh toán.',
        'Gửi hóa đơn cho chủ nhà để được **hoàn lại chi phí đậu xe trong thời gian lưu trú**.',
      ],
      instructionsEn: [
        'Parking is off-site, approximately a **3–4 minute walk** from the apartment.',
        'Use **tap & pay** at the car park or **pre-book** a space.',
        'Keep the **receipt or booking confirmation** after payment.',
        'Send the receipt to the host so the **parking cost for your stay can be reimbursed**.',
      ],
      messageVi: `Xin chào,\n\nChỗ đậu xe cho ${apartment} nằm tại một bãi xe an toàn cách căn hộ khoảng 3–4 phút đi bộ.\n\nBạn có thể sử dụng tap & pay hoặc đặt chỗ trước. Bên mình sẽ chi trả chi phí đậu xe trong thời gian lưu trú. Vui lòng giữ lại hóa đơn hoặc xác nhận đặt chỗ và gửi cho bên mình sau khi thanh toán để được hoàn lại chi phí.\n\nLưu ý: bãi xe nằm ngoài tòa nhà và không có thẻ đậu xe cần nhận.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nParking for ${apartment} is available at a secure paid car park approximately a 3–4 minute walk from the apartment.\n\nYou may use tap & pay or pre-book a space. We will cover the parking cost for your stay. Please keep the receipt or booking confirmation and send it to us after payment so we can arrange reimbursement.\n\nPlease note that parking is off-site and there is no parking card to collect.\n\nThank you.`,
      photos: [],
    };
  }

  if (normalized.endsWith('bliss terrace city pad | 2 balcony')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe miễn phí',
      statusEn: 'Free parking included',
      locationVi: '1–19 Allen Street, Pyrmont',
      locationEn: '1–19 Allen Street, Pyrmont',
      accessVi: 'Nhận remote fob trong hộp thư trước',
      accessEn: 'Collect the remote fob from the mailbox first',
      spot: 'Garage #77',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=1-19+Allen+Street+Pyrmont+NSW',
      noteVi: 'Đây là khu dân cư. Không nhắc đến Airbnb. Nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.',
      noteEn: 'This is a residential building. Do not mention Airbnb. If asked, say you are a friend of the parking owner.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Nhận **bộ chìa khóa và remote fob** từ hộp thư trước.',
        'Đi đến **1–19 Allen Street, Pyrmont** và dùng remote fob để vào bãi xe.',
        'Tìm đúng vị trí **Garage #77** như trong ảnh.',
        'Không nhắc đến **Airbnb**. Nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.',
        'Khi trả phòng, trả lại **remote fob cùng bộ chìa khóa** vào lockbox.',
      ],
      instructionsEn: [
        'Collect the **keyset and remote fob** from the mailbox first.',
        'Drive to **1–19 Allen Street, Pyrmont** and use the fob to enter the parking building.',
        'Locate and park in **Garage #77**, as shown in the photo.',
        'Do not mention **Airbnb**. If asked, say you are a friend of the parking owner.',
        'At checkout, return the **remote fob together with the keyset** to the lockbox.',
      ],
      messageVi: `Xin chào,\n\nHy vọng bạn đang háo hức cho kỳ nghỉ sắp tới. Nếu bạn cần chỗ đậu xe, bên mình đã bổ sung tiện ích đậu xe miễn phí.\n\nBãi xe nằm tại 1–19 Allen Street, Pyrmont. Vui lòng nhận bộ chìa khóa và remote fob từ hộp thư trước, sau đó dùng remote để vào tòa nhà và tìm Garage #77.\n\nĐây là khu dân cư, vì vậy vui lòng không nhắc đến Airbnb. Nếu được hỏi, bạn có thể nói mình là bạn của chủ chỗ đậu xe.\n\nKhi trả phòng, remote fob phải được trả lại cùng bộ chìa khóa vào lockbox theo hướng dẫn checkout được gửi sau.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nWe hope you're excited for your upcoming stay. If you require parking, we recently upgraded our stay amenities to include it for free.\n\nParking is located at 1–19 Allen Street, Pyrmont. Please collect the keyset and remote fob from our mailbox first, then use the fob to enter the residential parking building and locate Garage #77.\n\nThis is a residential building, so please do not mention Airbnb. If asked, you may say you are a friend of the parking owner.\n\nThe remote fob must be returned together with the keyset to the lockbox at checkout. The lockbox instructions will be sent separately.\n\nThanks.`,
      photos: [{
        storagePath: BUILTIN_BLISS_PHOTO,
        captionVi: 'Vị trí đậu xe Garage #77 tại 1–19 Allen Street, Pyrmont.',
        captionEn: 'Garage #77 parking bay at 1–19 Allen Street, Pyrmont.',
        url: BLISS_GARAGE_77_IMAGE,
      }],
    };
  }


  if (normalized.endsWith('blue enclave | casino & darling harbour walk')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe miễn phí · cần đặt trước',
      statusEn: 'Free parking · reservation required',
      locationVi: '152 Bulwara Road, Pyrmont NSW 2009 · cách căn hộ khoảng 4 phút đi bộ',
      locationEn: '152 Bulwara Road, Pyrmont NSW 2009 · approximately a 4-minute walk',
      accessVi: 'Nhận key fob từ hộp thư trước rồi quét tại cổng',
      accessEn: 'Collect the key fob from the mailbox first, then scan it at the gate',
      spot: 'Parking spot #64',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=152+Bulwara+Road+Pyrmont+NSW+2009',
      noteVi: 'Hãy nhắn “PARKING NEEDED” để bên mình giữ chỗ. Chỉ đậu đúng ô #64. Không nhắc đến Airbnb; nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe. Phần lớn kích thước và chiều cao xe thông thường đều phù hợp.',
      noteEn: 'Reply “PARKING NEEDED” so we can reserve the space. Park only in spot #64. Do not mention Airbnb; if asked, say you are a friend of the parking owner. Most standard car sizes and heights should fit.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Nhắn **“PARKING NEEDED”** trước kỳ lưu trú để bên mình giữ chỗ miễn phí.',
        'Nhận **key fob** từ hộp thư cùng bộ chìa khóa trước khi đi đến bãi xe.',
        'Đi đến **152 Bulwara Road, Pyrmont NSW 2009**, cách căn hộ khoảng **4 phút đi bộ**.',
        'Đảm bảo bạn đang ở đúng bãi xe. Quét key fob tại đầu đọc cạnh cổng; nếu đúng bãi, cổng sẽ nhận thẻ và mở.',
        'Chỉ đậu tại **parking spot #64**. Không đậu nhầm sang bất kỳ vị trí nào khác.',
        'Đây là bãi xe dành cho cư dân. Không nhắc đến **Airbnb**; nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.',
        'Ngoài ra, thường có thể đậu xe miễn phí trên đường từ khoảng **10:00 PM đến 7:00 AM**, nhưng phải kiểm tra biển báo tại chỗ.',
      ],
      instructionsEn: [
        'Reply **“PARKING NEEDED”** before your stay so we can reserve the complimentary space.',
        'Collect the **key fob** from our mailbox together with the keyset before going to the car park.',
        'Go to **152 Bulwara Road, Pyrmont NSW 2009**, approximately a **4-minute walk** from the apartment.',
        'Make sure you are at the correct car park. Scan the key fob at the reader beside the gate; the gate should recognise it and open.',
        'Park only in **parking spot #64**. Do not park in any other space.',
        'This parking is normally for building residents. Do not mention **Airbnb**; if asked, say you are a friend of the parking owner.',
        'Free street parking is also usually available from approximately **10:00 PM to 7:00 AM**, subject to the signs displayed on the street.',
      ],
      messageVi: `Xin chào,\n\nHy vọng bạn đang háo hức cho kỳ nghỉ sắp tới. Nếu bạn cần đậu xe, bên mình hiện có thể cung cấp một chỗ đậu xe miễn phí. Vui lòng trả lời **“PARKING NEEDED”** để bên mình giữ chỗ cho bạn.\n\nBãi xe nằm tại **152 Bulwara Road, Pyrmont NSW 2009**, cách căn hộ khoảng 4 phút đi bộ. Bạn cần nhận key fob từ hộp thư trước, sau đó quét key fob tại cổng. Hãy chắc chắn bạn đến đúng bãi xe.\n\nVui lòng chỉ đậu tại **parking spot #64** và không đậu nhầm vị trí khác. Phần lớn kích thước và chiều cao xe thông thường đều phù hợp.\n\nĐây là bãi xe dành cho cư dân, vì vậy vui lòng không nhắc đến Airbnb. Nếu được hỏi, bạn có thể nói mình là bạn của chủ chỗ đậu xe.\n\nNgoài ra, thường có chỗ đậu xe miễn phí trên đường từ khoảng 10:00 PM đến 7:00 AM, nhưng vui lòng luôn kiểm tra biển báo tại chỗ.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nWe hope you're excited for your upcoming stay. If you require parking, we recently upgraded our stay amenities to include a complimentary space. Please reply **“PARKING NEEDED”** so we can reserve it for you.\n\nParking is located at **152 Bulwara Road, Pyrmont NSW 2009**, approximately a 4-minute walk from the apartment. Please collect the key fob from our mailbox first, then scan it at the car park gate. Make sure you are at the correct car park.\n\nPlease park only in **spot #64** and do not use any other space. Most standard car sizes and heights should fit.\n\nThis parking is normally for building residents, so please do not mention Airbnb. If asked, you may say you are a friend of the parking owner.\n\nFree street parking is also usually available between approximately 10:00 PM and 7:00 AM, but please check the street signs.\n\nThanks.`,
      photos: [
        {
          storagePath: BUILTIN_BLUE_ENCLAVE_BUILDING,
          captionVi: 'Mặt tiền The Darlington và lối xuống bãi xe tại 152 Bulwara Road.',
          captionEn: 'The Darlington building and car park entrance at 152 Bulwara Road.',
          url: builtinPhotoUrl(BUILTIN_BLUE_ENCLAVE_BUILDING),
        },
        {
          storagePath: BUILTIN_BLUE_ENCLAVE_KEY_FOB,
          captionVi: 'Quét key fob tại đầu đọc cạnh cổng bãi xe.',
          captionEn: 'Scan the key fob at the reader beside the car park gate.',
          url: builtinPhotoUrl(BUILTIN_BLUE_ENCLAVE_KEY_FOB),
        },
        {
          storagePath: BUILTIN_BLUE_ENCLAVE_SPOT_64,
          captionVi: 'Đậu xe đúng tại parking spot #64.',
          captionEn: 'Park only in parking spot #64.',
          url: builtinPhotoUrl(BUILTIN_BLUE_ENCLAVE_SPOT_64),
        },
      ],
    };
  }


  if (normalized.endsWith('casino enclave | prime 3br + fish market')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe miễn phí · vui lòng báo trước',
      statusEn: 'Free parking · please let us know in advance',
      locationVi: '152 Bulwara Road, Pyrmont NSW 2009 · cách căn hộ khoảng 4 phút đi bộ',
      locationEn: '152 Bulwara Road, Pyrmont NSW 2009 · approximately a 4-minute walk',
      accessVi: 'Lấy key fob trong keyset rồi quét tại cổng',
      accessEn: 'Collect the key fob from the keyset, then tap it at the gate',
      spot: 'Parking spot #57',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=152+Bulwara+Road+Pyrmont+NSW+2009',
      noteVi: 'Vui lòng báo trước nếu cần giữ chỗ. Chỉ đậu đúng ô #57, nằm xuống 1 tầng và ngay cạnh thang máy LEVEL 2. Không nhắc đến Airbnb vì đây là bãi xe dành cho cư dân. Phần lớn kích thước và chiều cao xe thông thường đều phù hợp.',
      noteEn: 'Please let us know if we should reserve this spot for you. Park only in spot #57, which is one level down and right next to the LEVEL 2 lifts. Do not mention Airbnb because the car park is intended for residents. Most standard car sizes and heights should fit.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Nếu cần đậu xe miễn phí, vui lòng báo trước để bên mình giữ chỗ cho bạn.',
        'Bãi xe nằm tại **152 Bulwara Road, Pyrmont NSW 2009**, cách căn hộ khoảng **4 phút đi bộ**.',
        'Key fob nằm cùng **key set** mà bên mình sẽ gửi hướng dẫn nhận sau đó. Hãy lấy **key fob** từ keyset trước khi vào bãi xe.',
        'Đi đúng lối xuống bãi xe như trong ảnh, sau đó **quét key fob tại đầu đọc ở cổng** để mở cổng.',
        'Vào trong bãi xe và đậu đúng tại **spot #57** — vị trí này **xuống 1 tầng** và nằm **ngay cạnh thang máy LEVEL 2**.',
        'Vui lòng đậu xe **đúng vị trí và gọn trong ô**. Không đậu sang vị trí khác.',
        'Đây là bãi xe dành cho cư dân nên vui lòng **không nhắc đến Airbnb** trong khu vực đậu xe.',
        'Sau khi đậu xe xong, đi đến thang máy, **quét key fob** rồi bấm **Level 4** (tương đương tầng trệt / ground level). Sau đó bạn có thể ra vào tự do.',
      ],
      instructionsEn: [
        'If you require parking, please let us know in advance so we can reserve the complimentary space for you.',
        'Parking is located at **152 Bulwara Road, Pyrmont NSW 2009**, approximately a **4-minute walk** from the apartment.',
        'The **key fob** is located with your **key set**, which we will send later. Please collect the fob from the keyset before entering the car park.',
        'Go to the correct car park entrance as shown in the photo, then **tap the key fob at the gate reader** to open the gate.',
        'Once inside, park only in **spot #57** — this spot is **one level down** and **right next to the LEVEL 2 lifts**.',
        'Please park **correctly and neatly within the bay**. Do not use any other spot.',
        'Please do **not mention Airbnb** in the parking area, as this car park is intended for residents and building staff can be strict.',
        'After parking, go to the lifts, **tap the fob** and press **Level 4** (which is essentially ground level). You can exit freely after that.',
      ],
      messageVi: `Xin chào,

Hy vọng bạn đang háo hức cho kỳ nghỉ sắp tới. Nếu bạn cần đậu xe, bên mình hiện có thể cung cấp **1 chỗ đậu xe miễn phí**. Vui lòng báo lại để bên mình giữ chỗ cho bạn.

Bãi xe nằm tại **152 Bulwara Road, Pyrmont NSW 2009**, cách căn hộ khoảng **4 phút đi bộ**. **Key fob** nằm cùng **key set** mà bên mình sẽ gửi hướng dẫn nhận sau. Bạn cần lấy key fob từ keyset trước khi vào bãi xe.

Khi đến nơi, hãy quét key fob tại cổng để vào bãi xe, sau đó đậu đúng tại **spot #57**. Vị trí này nằm **xuống 1 tầng** và **ngay cạnh thang máy LEVEL 2**. Vui lòng đậu xe đúng vị trí và không đậu sang ô khác.

Lưu ý: đây là bãi xe dành cho cư dân, vì vậy vui lòng **không nhắc đến Airbnb** trong khu vực đậu xe.

Sau khi đậu xe, đi đến thang máy, quét key fob và bấm **Level 4** (tương đương tầng trệt / ground level). Sau đó bạn có thể ra vào tự do.

Cảm ơn bạn.`,
      messageEn: `Hi,

We hope you're excited for your upcoming stay. If you require parking, we can provide **one complimentary parking space**. Please let us know if we should reserve this spot for you.

Parking is located at **152 Bulwara Road, Pyrmont NSW 2009**, approximately a **4-minute walk** from the apartment. The **key fob** is located with your **key set**, which we will send later. Please collect the fob from the keyset before entering the car park.

When you arrive, tap the fob at the gate to enter, then park only in **spot #57**. This space is **one level down** and **right next to the LEVEL 2 lifts**. Please park correctly and do not use any other spot.

Please note that this car park is intended for residents, so please **do not mention Airbnb** in the parking area.

Once parked, go to the lifts, tap the fob and press **Level 4** (which is essentially ground level). You can exit freely after that.

Thanks.`,
      photos: [
        {
          storagePath: BUILTIN_CASINO_ENCLAVE_BUILDING,
          captionVi: 'Mặt tiền The Darlington và lối xuống bãi xe tại 152 Bulwara Road.',
          captionEn: 'The Darlington building and car park entrance at 152 Bulwara Road.',
          url: builtinPhotoUrl(BUILTIN_CASINO_ENCLAVE_BUILDING),
        },
        {
          storagePath: BUILTIN_CASINO_ENCLAVE_KEY_FOB,
          captionVi: 'Quét key fob tại đầu đọc ở cổng bãi xe.',
          captionEn: 'Tap the key fob at the car park gate reader.',
          url: builtinPhotoUrl(BUILTIN_CASINO_ENCLAVE_KEY_FOB),
        },
        {
          storagePath: BUILTIN_CASINO_ENCLAVE_LEVEL_2_LIFTS,
          captionVi: 'Đi đến khu thang máy LEVEL 2 sau khi đậu xe.',
          captionEn: 'Go to the LEVEL 2 lift area after parking.',
          url: builtinPhotoUrl(BUILTIN_CASINO_ENCLAVE_LEVEL_2_LIFTS),
        },
        {
          storagePath: BUILTIN_CASINO_ENCLAVE_SPOT_57,
          captionVi: 'Đậu xe đúng tại parking spot #57.',
          captionEn: 'Park only in parking spot #57.',
          url: builtinPhotoUrl(BUILTIN_CASINO_ENCLAVE_SPOT_57),
        },
      ],
    };
  }

  if (normalized.endsWith('corfu house | steps of cbd')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe đường phố miễn phí',
      statusEn: 'Free street parking',
      locationVi: 'Đậu xe trên đường gần căn hộ',
      locationEn: 'Street parking near the apartment',
      accessVi: 'Tuân theo biển báo đỗ xe trên đường',
      accessEn: 'Follow the street parking signs',
      spot: '',
      mapUrl: '',
      noteVi: 'Đậu xe miễn phí trên đường. Ngày thường thường giới hạn 2 giờ, sau khoảng 4:00 PM thường không giới hạn. Cuối tuần thường miễn phí không giới hạn. Luôn kiểm tra biển báo thực tế tại chỗ.',
      noteEn: 'Free street parking is available. On weekdays it is typically limited to 2 hours, then usually becomes unlimited after around 4:00 PM. On weekends it is usually free and unlimited. Always check the street signs on arrival.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Có thể đậu xe **miễn phí trên đường** gần căn hộ.',
        'Vào **ngày thường**, đậu xe thường giới hạn **2 giờ**.',
        'Sau khoảng **4:00 PM**, chỗ đậu trên đường thường **không giới hạn thời gian**.',
        'Vào **cuối tuần**, đậu xe trên đường thường **miễn phí và không giới hạn**.',
        'Vui lòng luôn **kiểm tra biển báo tại vị trí đậu xe** để xác nhận điều kiện thực tế.',
      ],
      instructionsEn: [
        'There is **free street parking** available near the apartment.',
        'On **weekdays**, parking is typically limited to **2 hours**.',
        'After around **4:00 PM**, street parking is usually **unlimited**.',
        'On **weekends**, street parking is usually **free and unlimited**.',
        'Please always **check the parking signs where you park** to confirm the current restrictions.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, bạn có thể sử dụng **đậu xe miễn phí trên đường** gần căn hộ.

Ngày thường, chỗ đậu xe trên đường thường giới hạn **2 giờ**. Sau khoảng **4:00 PM**, thời gian đậu thường không giới hạn. Vào **cuối tuần**, chỗ đậu xe trên đường thường **miễn phí và không giới hạn**.

Vui lòng luôn kiểm tra biển báo tại nơi đậu xe để xác nhận quy định thực tế.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, there is **free street parking** available near the apartment.

On weekdays, street parking is typically limited to **2 hours**. After around **4:00 PM**, it is usually unlimited. On **weekends**, street parking is generally **free and unlimited**.

Please always check the local parking signs where you park to confirm the current restrictions.

Thanks.`,
      photos: [],
    };
  }

  if (normalized.endsWith('heavens panorama | water views')) {
    return {
      enabled: true,
      statusVi: 'Có bãi xe trả phí tại chỗ',
      statusEn: 'Affordable on-site paid parking',
      locationVi: 'Bãi xe ngay tại chỗ / trong khuôn viên',
      locationEn: 'On-site parking',
      accessVi: 'Có thể đặt trước hoặc đặt khi đến',
      accessEn: 'Can be pre-booked or booked on arrival',
      spot: '',
      mapUrl: '',
      noteVi: 'Khách có thể pre-book chỗ đậu xe tại chỗ với mức phí khá hợp lý. Nếu chưa đặt trước, khách vẫn có thể đặt khi đến nơi.',
      noteEn: 'Guests may pre-book on-site parking at an affordable cost. If not booked in advance, it can also be booked upon arrival.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Căn hộ có **bãi xe trả phí tại chỗ** với mức phí khá hợp lý.',
        'Bạn có thể **đặt trước** chỗ đậu xe trước khi đến.',
        'Nếu chưa đặt trước, bạn vẫn có thể **đặt khi đến nơi / upon arrival**.',
        'Nếu cần hỗ trợ thêm, vui lòng nhắn cho bên mình.',
      ],
      instructionsEn: [
        'There is **affordable on-site paid parking** available for this apartment.',
        'You may **pre-book** your parking in advance.',
        'If you do not pre-book it, you may also **book it upon arrival**.',
        'Please message us if you need any further help with parking arrangements.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, bạn có thể sử dụng **bãi xe trả phí tại chỗ** với mức phí khá hợp lý.

Bạn có thể **đặt trước** chỗ đậu xe. Nếu chưa đặt trước, bạn vẫn có thể **đặt khi đến nơi**.

Nếu bạn cần hỗ trợ thêm về việc đậu xe, vui lòng nhắn cho bên mình.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, there is **affordable on-site paid parking** available.

You may **pre-book** your parking in advance. If not, you may also **book it upon arrival**.

Please let us know if you need any further assistance.

Thank you.`,
      photos: [],
    };
  }



  if (normalized.endsWith('the penthouse on pyrmont')) {
    return {
      enabled: true,
      statusVi: 'Có parking riêng đi kèm',
      statusEn: 'Private parking included',
      locationVi: '9 Quarry Master Drive',
      locationEn: '9 Quarry Master Drive',
      accessVi: 'Rẽ trái, rồi rẽ trái thêm lần nữa để đến khu parking',
      accessEn: 'Take a left, then left again to reach the parking area',
      spot: 'Private parking included',
      mapUrl: '',
      noteVi: 'Có parking riêng đi kèm kỳ lưu trú. Visitor parking trong khuôn viên được miễn phí nếu đậu dưới 24 giờ.',
      noteEn: 'Private parking is included with your stay. Visitor parking on the premises is free of charge for stays under 24 hours.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Căn **${apartment}** có **parking riêng đi kèm** với kỳ lưu trú.',
        'Ngoài ra, **visitor parking trong khuôn viên** cũng được **miễn phí nếu đậu dưới 24 giờ**.',
        'Khu parking nằm tại **9 Quarry Master Dr**.',
        'Để đến bãi xe, hãy **rẽ trái**, sau đó **rẽ trái thêm lần nữa**.',
      ],
      instructionsEn: [
        '**Private parking is included** with your stay at **${apartment}**.',
        '**Visitor parking on the premises** is also **free of charge if parked for less than 24 hours**.',
        'Parking is located at **9 Quarry Master Dr**.',
        'To reach the parking area, **take a left**, then **take a left again**.',
      ],
      messageVi: `Xin chào,

Căn **${apartment}** có **parking riêng đi kèm** với kỳ lưu trú. Ngoài ra, **visitor parking trong khuôn viên** cũng được **miễn phí nếu đậu dưới 24 giờ**.

Khu parking nằm tại **9 Quarry Master Dr**. Khi vào khu vực này, hãy **rẽ trái**, sau đó **rẽ trái thêm lần nữa** để đến chỗ đậu xe.

Cảm ơn bạn.`,
      messageEn: `Hi,

**Private parking is included** with your stay at **${apartment}**. In addition, **visitor parking on the premises** is **free of charge if parked for less than 24 hours**.

Parking is located at **9 Quarry Master Dr**. To reach the parking area, **take a left**, then **take a left again**.

Thank you.`,
      photos: [],
    };
  }

  if (
    normalized.endsWith('122 kirribilli · timeless harbour enclave')
    || normalized.endsWith('122 kirribilli | timeless harbour enclave')
    || normalized.includes('timeless harbour enclave')
  ) {
    return {
      enabled: true,
      statusVi: 'Đậu xe trên đường miễn phí theo khung giờ',
      statusEn: 'Free street parking at certain times',
      locationVi: 'Đậu xe trên đường gần căn hộ',
      locationEn: 'Street parking near the apartment',
      accessVi: 'Tuân theo biển báo đậu xe trên đường',
      accessEn: 'Follow the local street parking signs',
      spot: '',
      mapUrl: '',
      noteVi: 'Cuối tuần và sau 4:00 PM ngày thường thường được đậu xe miễn phí không giới hạn. Từ 8:30 AM đến 4:00 PM ngày thường thường có 2 giờ miễn phí. Nếu cần có thể di chuyển xe giữa các ô, nhưng quy định này hiếm khi bị kiểm tra gắt.',
      noteEn: 'Street parking is generally free and unlimited on weekends and after 4:00 PM on weekdays. Between 8:30 AM and 4:00 PM on weekdays, it is usually free for 2 hours. You may move the car between spots if needed, though it is rarely enforced.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Có thể sử dụng **đậu xe trên đường** gần căn hộ.',
        'Vào **cuối tuần** và **sau 4:00 PM các ngày trong tuần**, đậu xe thường **miễn phí và không giới hạn**.',
        'Từ **8:30 AM – 4:00 PM** các ngày trong tuần, đậu xe trên đường thường **miễn phí trong 2 giờ**.',
        'Nếu cần, bạn có thể **di chuyển xe giữa các vị trí** để tiếp tục đậu, tuy nhiên điều này **hiếm khi bị kiểm tra gắt**.',
        'Vui lòng luôn kiểm tra biển báo tại nơi đậu xe để xác nhận quy định thực tế.',
      ],
      instructionsEn: [
        'Street parking is available near the apartment.',
        'On **weekends** and **after 4:00 PM on weekdays**, parking is generally **free and unlimited**.',
        'Between **8:30 AM and 4:00 PM** on weekdays, street parking is usually **free for 2 hours**.',
        'If needed, you may **move your car between spots**, although this is **rarely enforced**.',
        'Please always check the street signs where you park to confirm the current restrictions.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, bạn có thể sử dụng **đậu xe trên đường** gần căn hộ.

- **Cuối tuần** và **sau 4:00 PM ngày thường**: thường **miễn phí và không giới hạn**
- **8:30 AM – 4:00 PM ngày thường**: thường **miễn phí trong 2 giờ**

Nếu cần, bạn có thể di chuyển xe giữa các vị trí, tuy nhiên điều này hiếm khi bị kiểm tra gắt. Vui lòng luôn kiểm tra biển báo thực tế tại nơi đậu xe.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, street parking is available nearby.

- **Weekends** and **after 4:00 PM on weekdays**: usually **free and unlimited**
- **8:30 AM – 4:00 PM on weekdays**: usually **free for 2 hours**

If needed, you may move your car between spots, although this is rarely enforced. Please always check the parking signs where you park.

Thank you.`,
      photos: [],
    };
  }

  if (normalized.endsWith('ultimo chic home | modern 2br')) {
    return {
      enabled: true,
      statusVi: 'Có bãi xe dùng fob tại 486 Jones Street',
      statusEn: 'Fob-access parking at 486 Jones Street',
      locationVi: '486 Jones Street',
      locationEn: '486 Jones Street',
      accessVi: 'Giữ fob trước gate scanner vài giây để vào bãi xe',
      accessEn: 'Hold the fob on the gate scanner for a few seconds to enter',
      spot: '',
      mapUrl: 'https://maps.app.goo.gl/EG5w38DEWYzdPrp37',
      noteVi: 'Sau khi vào bãi xe, bạn có thể dùng fire exit door hoặc thang máy gần khu garbage bins / loading area. Lưu ý thang máy có thể đưa bạn sang building kế bên thay vì đúng tòa nhà của căn hộ.',
      noteEn: 'After entering the car park, you can use either the fire exit door or the lift near the garbage bins/loading area. Please note the lift may take you into the neighbouring building rather than directly into your exact building.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Vui lòng lái xe đến **486 Jones Street**.',
        'Bản đồ: https://maps.app.goo.gl/EG5w38DEWYzdPrp37',
        'Giữ **fob** trước **gate scanner** trong **vài giây** để vào bãi xe.',
        'Sau khi vào bãi xe, bạn có thể dùng **fire exit door** hoặc **thang máy** gần khu **garbage bins / loading area**.',
        'Lưu ý: thang máy có thể đưa bạn sang **tòa nhà lân cận** chứ không đi thẳng đến đúng building của căn hộ.',
      ],
      instructionsEn: [
        'Please drive to **486 Jones Street**.',
        'Map: https://maps.app.goo.gl/EG5w38DEWYzdPrp37',
        'Hold the **fob** on the **gate scanner** for a **few seconds** to enter the car park.',
        'From there, you can use either the **fire exit door** or the **lift** near the **garbage bins / loading area**.',
        'Please note that the lift may take you into the **neighbouring building** rather than directly into your exact building.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, vui lòng lái xe đến **486 Jones Street**:
https://maps.app.goo.gl/EG5w38DEWYzdPrp37

Giữ **fob** trước **gate scanner** trong vài giây để vào bãi xe. Sau khi vào bên trong, bạn có thể sử dụng **fire exit door** hoặc **thang máy** gần khu **garbage bins / loading area**.

Lưu ý: thang máy có thể đưa bạn sang **tòa nhà lân cận** thay vì đúng building của căn hộ.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, please drive to **486 Jones Street**:
https://maps.app.goo.gl/EG5w38DEWYzdPrp37

Hold the **fob** on the **gate scanner** for a few seconds to enter the car park. From there, you can use either the **fire exit door** or the **lift** near the **garbage bins / loading area**.

Please note that the lift may take you into the **neighbouring building** rather than directly into your exact building.

Thank you.`,
      photos: [],
    };
  }

  if (normalized.endsWith('bayside enclave | casino & harbour')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe tại Wilsons Parking — Harbourside',
      statusEn: 'Parking at Wilsons Parking — Harbourside',
      locationVi: '100 Murray Street, Pyrmont NSW 2009 · Wilsons Parking — Harbourside',
      locationEn: '100 Murray Street, Pyrmont NSW 2009 · Wilsons Parking — Harbourside',
      accessVi: 'Dùng apartment fob / access card để quét vào Wilsons Parking rồi đi đến Level 2',
      accessEn: 'Use the apartment fob / access card to tap into Wilsons Parking, then drive to Level 2',
      spot: 'Level 2 · hướng cuối bãi · cổng riêng',
      mapUrl: '',
      noteVi: 'Chỉ sử dụng đúng bãi xe **Wilsons Parking — Harbourside** tại 100 Murray Street. Fob / access card nằm cùng key set và là cùng loại với apartment fob. Hướng dẫn nhận key sẽ được gửi trong check-in instructions.',
      noteEn: 'Please use only **Wilsons Parking — Harbourside** at 100 Murray Street. The fob / access card is located with the key set and is the same as the apartment fob. Key access details will be included in the check-in instructions.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Địa chỉ parking là **100 Murray Street, Pyrmont NSW 2009**.',
        'Chỉ sử dụng đúng bãi xe **Wilsons Parking — Harbourside**.',
        'Hướng dẫn check-in đầy đủ sẽ được gửi lúc **10:00 AM vào ngày trước khi check-in**. Giờ check-in tiêu chuẩn là **từ 3:00 PM**, trừ khi đã có thỏa thuận khác.',
        'Sau khi nhận **key set / apartment fob**, dùng **fob / access card** để **quét vào Wilsons Parking**.',
        'Sau khi vào trong, lái xe đến **Level 2**.',
        'Tiếp tục đi **về phía cuối bãi** và **tìm cổng** như trong ảnh hướng dẫn.',
        'Access card này nằm cùng **key set** và là **chính apartment fob**.',
      ],
      instructionsEn: [
        'The parking address is **100 Murray Street, Pyrmont NSW 2009**.',
        'Please make sure you use only **Wilsons Parking — Harbourside**.',
        'Your full check-in instructions will be sent at **10:00 AM on the day before check-in**. Standard check-in is from **3:00 PM**, unless otherwise agreed.',
        'Once you receive the **key set / apartment fob**, use the **fob / access card** to **tap into Wilsons Parking**.',
        'After entering, drive to **Level 2**.',
        'Continue towards the **end of the car park** and **look for the gate**, as shown in the reference images.',
        'This access card is located with the **key set** and is the **same as the apartment fob**.',
      ],
      messageVi: `Xin chào,

Dưới đây là thông tin parking cho căn **${apartment}**:

**Địa chỉ bãi xe:**
100 Murray Street, Pyrmont NSW 2009
**Wilsons Parking — Harbourside**

Vui lòng chỉ sử dụng đúng bãi xe này.

Hướng dẫn check-in đầy đủ sẽ được gửi lúc **10:00 AM vào ngày trước khi check-in**. Giờ check-in tiêu chuẩn là **từ 3:00 PM**, trừ khi đã có thỏa thuận khác.

Sau khi nhận **key set / apartment fob**, hãy dùng **fob / access card** để quét vào **Wilsons Parking**. Sau đó lái xe lên **Level 2**, đi **về phía cuối bãi** và **tìm cổng** như trong ảnh hướng dẫn.

Access card này nằm cùng **key set** và cũng chính là **apartment fob**.

Cảm ơn bạn.`,
      messageEn: `Hi,

Please read the parking details below carefully for **${apartment}**.

**Parking address:**
100 Murray Street, Pyrmont NSW 2009
**Wilsons Parking — Harbourside**

Please make sure you only use this car park.

Your full check-in instructions will be sent at **10:00 AM on the day before check-in**. Standard check-in is from **3:00 PM**, unless we have agreed otherwise.

Once you receive your **key set / apartment fob**, use the **fob / access card** to tap into **Wilsons Parking**. After entering, drive to **Level 2**, continue towards the **end**, and **look for the gate** as shown in the reference images.

This access card is located with the **key set**, and is the **same as the apartment fob**.

Thank you.`,
      photos: [
        {
          storagePath: BUILTIN_BAYSIDE_ENCLAVE_HARBOURSIDE_ENTRANCE,
          captionVi: 'Lối vào Wilsons Parking — Harbourside tại 100 Murray Street.',
          captionEn: 'Entrance to Wilsons Parking — Harbourside at 100 Murray Street.',
          url: builtinPhotoUrl(BUILTIN_BAYSIDE_ENCLAVE_HARBOURSIDE_ENTRANCE),
        },
        {
          storagePath: BUILTIN_BAYSIDE_ENCLAVE_FOB_GATE,
          captionVi: 'Dùng fob / access card để quét tại cổng vào bãi xe.',
          captionEn: 'Use the fob / access card at the entry gate scanner.',
          url: builtinPhotoUrl(BUILTIN_BAYSIDE_ENCLAVE_FOB_GATE),
        },
        {
          storagePath: BUILTIN_BAYSIDE_ENCLAVE_LEVEL_2_PANORAMA,
          captionVi: 'Tổng quan khu Level 2 và hướng di chuyển về cuối bãi.',
          captionEn: 'Overview of Level 2 and the direction towards the far end of the car park.',
          url: builtinPhotoUrl(BUILTIN_BAYSIDE_ENCLAVE_LEVEL_2_PANORAMA),
        },
        {
          storagePath: BUILTIN_BAYSIDE_ENCLAVE_SPOT_WIDE,
          captionVi: 'Ảnh rộng chỉ hướng đến vị trí / khu cổng ở cuối Level 2.',
          captionEn: 'Wider reference image showing the direction to the spot / gate at the end of Level 2.',
          url: builtinPhotoUrl(BUILTIN_BAYSIDE_ENCLAVE_SPOT_WIDE),
        },
        {
          storagePath: BUILTIN_BAYSIDE_ENCLAVE_SPOT_CLOSE,
          captionVi: 'Ảnh cận vị trí đậu xe tham chiếu tại khu vực cuối Level 2.',
          captionEn: 'Close-up reference of the parking position near the far end of Level 2.',
          url: builtinPhotoUrl(BUILTIN_BAYSIDE_ENCLAVE_SPOT_CLOSE),
        },
      ],
    };
  }


  if (
    normalized.endsWith('panoramic escape: bridge & opera gem')
    || normalized.endsWith('panoramic escape | bridge & opera gem')
  ) {
    return {
      enabled: true,
      statusVi: 'Chỗ đậu xe riêng đi kèm căn hộ',
      statusEn: 'Dedicated parking space included',
      locationVi: 'Khu đậu xe nằm giữa Robertson Lane và Fitzroy Street',
      locationEn: 'Parking is located between Robertson Lane and Fitzroy Street',
      accessVi: 'Đậu tại đúng chỗ số #35',
      accessEn: 'Park only in spot #35',
      spot: 'Parking spot #35',
      mapUrl: 'https://maps.app.goo.gl/PAz6vceyRksXg6eP7?g_st=ic',
      noteVi: 'Chỗ đậu xe của bạn là vị trí **#35**, tại đúng nơi chiếc xe màu xám đang đậu trong ảnh tham chiếu. Vui lòng chỉ đậu đúng vị trí này.',
      noteEn: 'Your parking space is **#35**, located where the grey car is parked in the reference image. Please use only this designated bay.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Chỗ đậu xe nằm tại khu vực giữa **Robertson Lane** và **Fitzroy Street**.',
        'Bản đồ: https://maps.app.goo.gl/PAz6vceyRksXg6eP7?g_st=ic',
        'Vị trí của bạn là **parking spot #35**.',
        'Hãy sử dụng các ảnh tham chiếu để xác định đúng khu đậu xe và đúng vị trí.',
        'Chỗ của bạn là nơi chiếc xe mẫu đang đậu trong ảnh, vui lòng **chỉ đậu đúng ô #35**.',
      ],
      instructionsEn: [
        'The parking area is located between **Robertson Lane** and **Fitzroy Street**.',
        'Map link: https://maps.app.goo.gl/PAz6vceyRksXg6eP7?g_st=ic',
        'Your space is **parking spot #35**.',
        'Please use the reference photos to identify the correct parking area and the correct bay.',
        'Your space is the one where the example car is parked in the image, so please **park only in spot #35**.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, chỗ đậu xe nằm giữa **Robertson Lane** và **Fitzroy Street**.

Bản đồ: https://maps.app.goo.gl/PAz6vceyRksXg6eP7?g_st=ic

Chỗ của bạn là **parking spot #35**. Vui lòng xem ảnh tham chiếu để xác định đúng vị trí — đó là nơi chiếc xe mẫu đang đậu trong ảnh.

Vui lòng chỉ đậu đúng ô **#35**.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, your parking is located between **Robertson Lane** and **Fitzroy Street**.

Map: https://maps.app.goo.gl/PAz6vceyRksXg6eP7?g_st=ic

Your designated space is **parking spot #35**. Please refer to the images to identify the correct location — it is the bay where the example car is shown parked.

Please park only in **spot #35**.

Thank you.`,
      photos: [
        {
          storagePath: BUILTIN_PANORAMIC_ESCAPE_OVERVIEW,
          captionVi: 'Tổng quan khu đậu xe nhìn từ trên cao để xác định khu vực đúng.',
          captionEn: 'Overview of the parking area from above to help identify the correct location.',
          url: builtinPhotoUrl(BUILTIN_PANORAMIC_ESCAPE_OVERVIEW),
        },
        {
          storagePath: BUILTIN_PANORAMIC_ESCAPE_SPOT_35,
          captionVi: 'Đậu xe tại đúng vị trí được khoanh tròn / chỉ dẫn trong ảnh.',
          captionEn: 'Park in the exact bay highlighted in the reference image.',
          url: builtinPhotoUrl(BUILTIN_PANORAMIC_ESCAPE_SPOT_35),
        },
      ],
    };
  }

  if (normalized.endsWith('sun-lit oasis | darling harbour')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe đường phố có trả phí hoặc bãi gần đó',
      statusEn: 'Timed paid street parking or nearby car park',
      locationVi: 'Đậu xe trên đường hoặc Secure Parking Harris Street',
      locationEn: 'Street parking or Secure Parking Harris Street',
      accessVi: 'Đậu xe trên đường có giới hạn hoặc đặt bãi xe gần đó',
      accessEn: 'Use timed street parking or a nearby paid car park',
      spot: '',
      mapUrl: 'https://www.secureparking.com.au/en-au/car-parks/australia/nsw/harris-street-sydney-car-park/',
      noteVi: 'Không có parking miễn phí trong accommodation. Có đậu xe trên đường có thu phí theo thời gian, hoặc có thể dùng Secure Parking Harris Street — thường là một trong những lựa chọn rẻ nhất trong khu vực. Đậu xe trên đường thường giới hạn 2 giờ và hay được kiểm tra.',
      noteEn: 'There is no free parking included with the accommodation. Timed paid street parking is available, or you can use Secure Parking Harris Street, which is often one of the cheaper nearby options. Street parking is usually limited to 2 hours and is checked regularly.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Hiện tại **không có parking miễn phí** đi kèm accommodation.',
        'Bạn có thể dùng **đậu xe trên đường có trả phí theo thời gian** gần căn hộ.',
        'Đậu xe trên đường **thường giới hạn 2 giờ** và khu vực này **kiểm tra khá thường xuyên**.',
        'Nếu muốn phương án gần và hợp lý hơn, bạn có thể sử dụng **Secure Parking Harris Street**:',
        'https://www.secureparking.com.au/en-au/car-parks/australia/nsw/harris-street-sydney-car-park/',
        'Đây thường là **một trong những lựa chọn rẻ nhất trong khu vực**.',
      ],
      instructionsEn: [
        'At the moment, there is **no free parking included** with the accommodation.',
        'You may use **timed paid street parking** near the apartment.',
        'Street parking is **usually limited to 2 hours** and the area is **checked quite often**.',
        'If you prefer a nearby paid option, you may use **Secure Parking Harris Street**:',
        'https://www.secureparking.com.au/en-au/car-parks/australia/nsw/harris-street-sydney-car-park/',
        'This is often **one of the cheapest parking options in the area**.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, hiện tại **không có parking miễn phí** đi kèm chỗ ở.

Bạn có thể sử dụng **đậu xe trên đường có trả phí theo thời gian**, tuy nhiên chỗ đậu trên đường thường **giới hạn 2 giờ** và khá hay được kiểm tra.

Nếu muốn một lựa chọn gần đó với chi phí hợp lý, bạn có thể dùng **Secure Parking Harris Street**:
https://www.secureparking.com.au/en-au/car-parks/australia/nsw/harris-street-sydney-car-park/

Đây thường là một trong những lựa chọn rẻ nhất trong khu vực.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, unfortunately there is **no free parking included** with the accommodation.

You may use **timed paid street parking**, but street parking is usually **limited to 2 hours** and is checked quite often.

A nearby paid option is **Secure Parking Harris Street**:
https://www.secureparking.com.au/en-au/car-parks/australia/nsw/harris-street-sydney-car-park/

This is often one of the cheapest parking options in the area.

Thank you.`,
      photos: [],
    };
  }

  if (normalized.endsWith('the grand pyrmont | casino & harbour')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe riêng trong khu GRANDE',
      statusEn: 'Private parking inside the GRANDE complex',
      locationVi: 'Bãi xe trong khu GRANDE, kết nối trực tiếp với nhà',
      locationEn: 'Parking inside the GRANDE complex, directly connected to the house',
      accessVi: 'Dùng remote xanh cho cổng chung, remote đen cho cửa gara riêng',
      accessEn: 'Use the blue-button remote for the main gate and the black remote for the private bay',
      spot: 'Ô gần nhất còn trống / gara riêng nối vào nhà',
      mapUrl: '',
      noteVi: 'Đây là khu đậu xe dân cư dùng chung. Vui lòng không nhắc đến Airbnb hoặc short-stay accommodation. Sau khi vào hoặc rời gara, hãy nhớ đóng lại cửa gara/cổng đậu xe của bạn.',
      noteEn: 'This is a shared residential parking area. Please avoid mentioning Airbnb or short-stay accommodation. Remember to close your parking gate/bay door after entering or leaving.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Trước tiên hãy dùng **remote có các nút màu xanh**.',
        'Nhấn **nút xanh góc trên bên phải** để mở cổng vào khu **GRANDE building**.',
        'Sau khi vào bên trong, vị trí của bạn sẽ là **ô đậu gần nhất còn trống / khu đậu được cấp cho căn nhà** như trong ảnh hướng dẫn.',
        'Để mở **gara / parking bay riêng**, dùng **remote màu đen** và nhấn **nút xám ở bên phải**.',
        'Khu đậu xe này **kết nối trực tiếp với căn nhà**. Bạn có thể vào nhà qua **cửa nối ở phía sau**.',
        'Sau khi đỗ xe hoặc khi rời đi, vui lòng **đóng lại cổng/cửa gara của chỗ đậu xe**.',
        'Đây là **khu đậu xe dân cư dùng chung**, vì vậy vui lòng **không nhắc đến Airbnb, short-stay hoặc thuê ngắn ngày** trong thời gian lưu trú.',
      ],
      instructionsEn: [
        'Please use the **remote with the blue buttons first**.',
        'Press the **top-right blue button** to open the gate to the **GRANDE building**.',
        'Once inside, your allocated parking space will be the **closest available car park / designated bay for the house**, as shown in the reference photos.',
        'To open your **private parking bay**, use the **black parking remote** and press the **grey button on the right**.',
        'The parking area **connects directly to the house**. You can access the property through the **connected door at the rear**.',
        'Please remember to **close the parking gate / bay door** after entering or leaving.',
        'This is a **shared residential parking area**, so please avoid mentioning **Airbnb, short-stay accommodation, or holiday rental** during your stay.',
      ],
      messageVi: `Xin chào,

Đối với căn **${apartment}**, vui lòng làm theo hướng dẫn đậu xe sau:

1. Dùng **remote có các nút màu xanh** trước.
2. Nhấn **nút xanh góc trên bên phải** để mở cổng vào khu **GRANDE building**.
3. Sau khi vào trong, vị trí đậu xe của bạn sẽ là **ô gần nhất còn trống / khu đậu được cấp cho căn nhà** như trong ảnh hướng dẫn.
4. Để mở **gara / parking bay riêng**, dùng **remote màu đen** và nhấn **nút xám ở bên phải**.
5. Khu đậu xe này **kết nối trực tiếp với căn nhà**, và bạn có thể vào nhà bằng **cửa ở phía sau**.
6. Sau khi vào hoặc rời đi, vui lòng **đóng lại cổng/cửa gara**.

Lưu ý: đây là **khu đậu xe dân cư dùng chung**, vì vậy vui lòng **không nhắc đến Airbnb hoặc short-stay accommodation** trong thời gian lưu trú.

Cảm ơn bạn.`,
      messageEn: `Hi,

For **${apartment}**, please follow these parking instructions:

1. Use the **remote with the blue buttons first**.
2. Press the **top-right blue button** to open the gate to the **GRANDE building**.
3. Once inside, your parking space will be the **closest available bay / designated bay for the house**, as shown in the reference photos.
4. To open your **private parking bay**, use the **black parking remote** and press the **grey button on the right**.
5. The parking area **connects directly to the house**, and you can enter the property through the **connected rear door**.
6. Please remember to **close the parking gate / bay door** after entering or leaving.

Friendly note: this is a **shared residential parking area**, so please avoid mentioning **Airbnb or short-stay accommodation** during your stay.

Thank you.`,
      photos: [
        {
          storagePath: BUILTIN_GRAND_PYRMONT_COMPLEX_ENTRANCE,
          captionVi: 'Lối vào khu GRANDE và cổng xuống bãi xe.',
          captionEn: 'Entrance to the GRANDE complex and vehicle gate.',
          url: builtinPhotoUrl(BUILTIN_GRAND_PYRMONT_COMPLEX_ENTRANCE),
        },
        {
          storagePath: BUILTIN_GRAND_PYRMONT_LANE_DIRECTION,
          captionVi: 'Hướng di chuyển bên trong khu bãi xe sau khi vào cổng chính.',
          captionEn: 'Direction of travel inside the parking area after entering the main gate.',
          url: builtinPhotoUrl(BUILTIN_GRAND_PYRMONT_LANE_DIRECTION),
        },
        {
          storagePath: BUILTIN_GRAND_PYRMONT_PRIVATE_BAY,
          captionVi: 'Khu gara / parking bay riêng kết nối trực tiếp với nhà qua cửa phía sau.',
          captionEn: 'Private parking bay connected directly to the house through the rear door.',
          url: builtinPhotoUrl(BUILTIN_GRAND_PYRMONT_PRIVATE_BAY),
        },
        {
          storagePath: BUILTIN_GRAND_PYRMONT_HOUSE_69,
          captionVi: 'Mặt tiền căn nhà số 69 trong khu GRANDE Pyrmont Bay Estate.',
          captionEn: 'Front exterior of house number 69 inside the GRANDE Pyrmont Bay Estate.',
          url: builtinPhotoUrl(BUILTIN_GRAND_PYRMONT_HOUSE_69),
        },
      ],
    };
  }


  if (normalized.endsWith('luxury 1bdr | sparkling harbourside')) {
    return {
      enabled: true,
      statusVi: 'Không có parking miễn phí · có bãi xe trả phí gần đó',
      statusEn: 'No free parking included · affordable paid parking nearby',
      locationVi: 'St Andrews House Town Hall, Cinema Centre hoặc các bãi xe gần căn hộ',
      locationEn: 'St Andrews House Town Hall, Cinema Centre or other nearby car parks',
      accessVi: 'Đặt trước bằng Wilson Parking app hoặc drive-in',
      accessEn: 'Pre-book with the Wilson Parking app or drive in',
      spot: '',
      mapUrl: 'https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/st-andrews-house-town-hall-car-park/',
      noteVi: 'Căn hộ không bao gồm chỗ đậu xe miễn phí. St Andrews House Town Hall có parking giá hợp lý gần đó. Cinema Centre Car Park thường có thể drive-in với giá khá rẻ và không cần prepay. Ngoài ra còn có street parking và nhiều bãi xe lân cận; nên đặt trước qua ứng dụng Wilson Parking.',
      noteEn: 'Free parking is not included with the accommodation. St Andrews House Town Hall offers affordable parking nearby. Cinema Centre Car Park is generally a cheap drive-in option and does not need to be prepaid. There is also street and other nearby parking; pre-booking through the Wilson Parking app is recommended.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Căn hộ **không bao gồm chỗ đậu xe miễn phí** trong tòa nhà.',
        'Bạn có thể đặt xe tại **St Andrews House Town Hall Car Park**, một lựa chọn giá hợp lý gần căn hộ.',
        'Link đặt St Andrews House Town Hall: https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/st-andrews-house-town-hall-car-park/',
        'Bạn cũng có thể **drive-in tại Cinema Centre Car Park**. Đây thường là lựa chọn khá rẻ và **không cần thanh toán trước**.',
        'Khu vực xung quanh có thêm street parking và nhiều bãi xe khác.',
        'Để có giá tốt và chắc chắn còn chỗ, nên **pre-book qua ứng dụng Wilson Parking**.',
      ],
      instructionsEn: [
        'There is **no free parking included** with the accommodation.',
        'You may park at **St Andrews House Town Hall Car Park**, which is an affordable nearby option.',
        'St Andrews House Town Hall booking link: https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/st-andrews-house-town-hall-car-park/',
        'You may also **drive in to Cinema Centre Car Park**. It is generally a cheap option and **does not need to be prepaid**.',
        'There is also street parking and a range of other nearby car parks.',
        'For a better rate and to secure a space, we recommend **pre-booking through the Wilson Parking app**.',
      ],
      messageVi: `Xin chào,\n\nĐối với căn **${apartment}**, hiện căn hộ **không bao gồm chỗ đậu xe miễn phí** trong tòa nhà.\n\nBạn có thể đặt trước tại **St Andrews House Town Hall Car Park**, một lựa chọn giá hợp lý gần căn hộ:\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/st-andrews-house-town-hall-car-park/\n\nBạn cũng có thể **drive-in tại Cinema Centre Car Park**. Đây thường là lựa chọn khá rẻ và không cần thanh toán trước. Khu vực xung quanh cũng có street parking và nhiều bãi xe gần đó.\n\nĐể có giá tốt và chắc chắn còn chỗ, bên mình khuyến nghị đặt trước qua **ứng dụng Wilson Parking**.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nFor **${apartment}**, please note that **free parking is not included** with the accommodation.\n\nYou may pre-book affordable parking at **St Andrews House Town Hall Car Park**:\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/st-andrews-house-town-hall-car-park/\n\nAlternatively, you may **drive in to Cinema Centre Car Park**, which is generally a cheap option and does not need to be prepaid. There is also street and other nearby parking available.\n\nFor a better rate and to secure a space, we recommend pre-booking through the **Wilson Parking app**.\n\nThanks.`,
      photos: [],
    };
  }

  if (normalized.endsWith('luxury 3br skyline | water views')) {
    return {
      enabled: true,
      statusVi: 'Không có parking trong tòa nhà · cần đặt bãi xe gần đó',
      statusEn: 'No parking in the building · nearby paid parking required',
      locationVi: 'Gần 38 York Street: 383 Kent Street, George Place hoặc 71 York Street',
      locationEn: 'Near 38 York Street: 383 Kent Street, George Place or 71 York Street',
      accessVi: 'Đặt trước online/app để có giá tốt hơn hoặc drive-in',
      accessEn: 'Pre-book online/in the app for a better rate or drive in',
      spot: '',
      mapUrl: 'https://www.wilsonparking.com.au/parking-locations/new-south-wales/cbd-sydney-south/383-kent-st-car-park/',
      noteVi: 'Không có bãi xe trong tòa nhà tại 38 York Street. Khuyến nghị dùng phương tiện công cộng: khoảng 5 phút đi bộ đến Wynyard Station và 4 phút đến trạm light rail. Nếu lái xe, nên đặt trước vì drive-in thường đắt hơn. George Place có giờ mở/đóng; có thể để xe bên trong khi đóng nhưng không thể ra vào trong thời gian đó.',
      noteEn: 'There is no parking in the building at 38 York Street. Public transport is recommended: approximately 5 minutes to Wynyard Station and 4 minutes to the light rail. If driving, pre-booking is recommended because drive-in rates are usually higher. George Place has opening and closing hours; the car may remain inside while closed, but it cannot be accessed during those hours.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Căn hộ tại **38 York Street, Sydney NSW 2000 không có parking trong tòa nhà**.',
        'Bên mình khuyến nghị sử dụng phương tiện công cộng vì đây thường là cách nhanh và thuận tiện nhất: khoảng **5 phút đi bộ đến Wynyard Station** và **4 phút đến trạm light rail**.',
        'Nếu lái xe, lựa chọn được khuyến nghị đầu tiên là **383 Kent Street Car Park**: https://www.wilsonparking.com.au/parking-locations/new-south-wales/cbd-sydney-south/383-kent-st-car-park/',
        'Lựa chọn thứ hai là **George Place Car Park**: https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/george-place-car-park/#',
        'George Place **không hoạt động 24 giờ**. Bạn có thể để xe bên trong khi bãi đóng cửa, nhưng sẽ **không thể tiếp cận xe trong giờ đóng cửa**.',
        'Một lựa chọn khác là **71 York Street Car Park**: https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/71-york-st-car-park/?utm_source=Google&utm_medium=GMB&utm_campaign=google_NSW-71-york-st&utm_term=plcid_17036516862398035298#',
        'Các bãi xe này có thể đặt qua app/online hoặc drive-in, nhưng **đặt trước thường rẻ hơn**, còn drive-in thường có giá cao hơn.',
      ],
      instructionsEn: [
        'There is **no parking in the building** at **38 York Street, Sydney NSW 2000**.',
        'We recommend public transport because it is usually the quickest and most convenient option: approximately a **5-minute walk to Wynyard Station** and **4 minutes to the light rail stop**.',
        'Our first recommended parking option is **383 Kent Street Car Park**: https://www.wilsonparking.com.au/parking-locations/new-south-wales/cbd-sydney-south/383-kent-st-car-park/',
        'The second option is **George Place Car Park**: https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/george-place-car-park/#',
        'George Place is **not accessible 24 hours**. You may leave the car inside during closed hours, but you **cannot access it while the car park is closed**.',
        'Another option is **71 York Street Car Park**: https://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/71-york-st-car-park/?utm_source=Google&utm_medium=GMB&utm_campaign=google_NSW-71-york-st&utm_term=plcid_17036516862398035298#',
        'These car parks can be booked through the app/online or used as drive-in parking, but **pre-booking is usually cheaper** and drive-in rates are generally higher.',
      ],
      messageVi: `Xin chào,\n\nĐối với căn **${apartment}** tại **38 York Street, Sydney NSW 2000**, xin lưu ý rằng **tòa nhà không có parking**.\n\nBên mình khuyến nghị sử dụng phương tiện công cộng vì đây là lựa chọn nhanh và thuận tiện nhất: căn hộ cách **Wynyard Station khoảng 5 phút đi bộ** và cách trạm **light rail khoảng 4 phút**.\n\nNếu bạn cần lái xe, có thể đặt trước các bãi xe sau:\n\n1. 383 Kent Street Car Park\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/cbd-sydney-south/383-kent-st-car-park/\n\n2. George Place Car Park\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/george-place-car-park/#\nLưu ý: bãi này không mở 24 giờ. Bạn có thể để xe bên trong trong giờ đóng cửa nhưng sẽ không thể tiếp cận xe.\n\n3. 71 York Street Car Park\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/71-york-st-car-park/?utm_source=Google&utm_medium=GMB&utm_campaign=google_NSW-71-york-st&utm_term=plcid_17036516862398035298#\n\nBạn có thể đặt qua app/online hoặc drive-in, nhưng **đặt trước thường rẻ hơn**.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nFor **${apartment}** at **38 York Street, Sydney NSW 2000**, please note that **there is no parking in the building**.\n\nWe recommend public transport because it is the quickest and most convenient option. The apartment is approximately a **5-minute walk from Wynyard Station** and **4 minutes from the light rail stop**.\n\nIf you need to drive, you may pre-book one of the following nearby options:\n\n1. 383 Kent Street Car Park\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/cbd-sydney-south/383-kent-st-car-park/\n\n2. George Place Car Park\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/george-place-car-park/#\nPlease note that this car park is not accessible 24 hours. You may leave the car inside during closed hours, but you cannot access it while the car park is closed.\n\n3. 71 York Street Car Park\nhttps://www.wilsonparking.com.au/parking-locations/new-south-wales/sydney-cbd/71-york-st-car-park/?utm_source=Google&utm_medium=GMB&utm_campaign=google_NSW-71-york-st&utm_term=plcid_17036516862398035298#\n\nYou can book through the app/online or drive in, but **pre-booking is usually cheaper**.\n\nHope this helps.`,
      photos: [],
    };
  }


  if (normalized.endsWith('maritime manor | coastal terrace')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe miễn phí có giới hạn thời gian',
      statusEn: 'Time-limited free parking available',
      locationVi: 'Đậu xe trên đường và bãi xe có mái che gần căn hộ',
      locationEn: 'Street parking and nearby undercover parking',
      accessVi: 'Tuân theo biển báo và giới hạn thời gian tại chỗ',
      accessEn: 'Follow the posted signs and time limits',
      spot: '',
      mapUrl: '',
      noteVi: 'Có chỗ đậu xe miễn phí trên đường trong khoảng 1–2 giờ. Gần đó cũng có bãi xe có mái che miễn phí tối đa 2 giờ. Vui lòng kiểm tra biển báo và điều kiện thực tế khi đến.',
      noteEn: 'Free street parking is available for approximately 1–2 hours. There is also nearby free undercover parking for up to 2 hours. Please check the posted signs and current conditions on arrival.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Có thể sử dụng **đậu xe miễn phí trên đường** gần căn hộ trong khoảng **1–2 giờ**.',
        'Gần đó cũng có **bãi xe có mái che miễn phí tối đa 2 giờ**.',
        'Các giới hạn có thể thay đổi theo vị trí và thời điểm, vì vậy vui lòng **kiểm tra biển báo tại chỗ** trước khi rời xe.',
        'Nếu cần đậu lâu hơn, hãy cân nhắc di chuyển xe hoặc sử dụng một bãi xe trả phí gần đó.',
      ],
      instructionsEn: [
        'There is **free street parking** available near the apartment for approximately **1–2 hours**.',
        'There is also **free undercover parking nearby for up to 2 hours**.',
        'Restrictions may vary by location and time, so please **check the signs where you park** before leaving the vehicle.',
        'For a longer stay, please consider moving the car or using a nearby paid car park.',
      ],
      messageVi: `Xin chào,\n\nĐối với căn **${apartment}**, gần căn hộ có **đậu xe miễn phí trên đường trong khoảng 1–2 giờ**.\n\nNgoài ra, gần đó cũng có **bãi xe có mái che miễn phí tối đa 2 giờ**.\n\nVui lòng kiểm tra biển báo tại vị trí đậu xe vì giới hạn có thể thay đổi theo khu vực và thời điểm. Nếu cần đậu lâu hơn, bạn nên di chuyển xe hoặc sử dụng một bãi xe trả phí gần đó.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nFor **${apartment}**, there is **free street parking nearby for approximately 1–2 hours**.\n\nThere is also **free undercover parking nearby for up to 2 hours**.\n\nPlease check the signs where you park, as restrictions may vary by location and time. For a longer stay, you may need to move the car or use a nearby paid car park.\n\nThank you.`,
      photos: [],
    };
  }

  if (normalized.endsWith('millers manor terrace | 3br')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe tại Barangaroo Point bằng access card',
      statusEn: 'Barangaroo Point parking with access card',
      locationVi: 'Barangaroo Point Car Park · 25 Hickson Road, Barangaroo',
      locationEn: 'Barangaroo Point Car Park · 25 Hickson Road, Barangaroo',
      accessVi: 'Chạm access card vào đèn/cảm biến màu xanh tại cổng',
      accessEn: 'Hold the access card against the green sensor/light at the gate',
      spot: 'Chỉ đậu ô không ghi RESERVED',
      mapUrl: 'https://share.google/LiueHkocRqNSRvSnZ',
      noteVi: 'Chỉ sử dụng đúng Barangaroo Point Wilson Parking, không vào Bond One hoặc bãi Wilson khác. Bãi đóng lúc nửa đêm nhưng được phép đậu qua đêm. Access card bị mất hoặc không trả lại keybox sẽ chịu phí thay thế $300.',
      noteEn: 'Use only the designated Barangaroo Point Wilson Parking location, not Bond One or any other Wilson car park. The car park closes at midnight, but overnight parking is permitted. A lost or unreturned access card incurs a $300 replacement fee.',
      internalNoteVi: '',
      internalNoteEn: '',
      internalEmailTo: '',
      internalEmailSubject: '',
      internalEmailBody: '',
      instructionsVi: [
        'Bãi xe nằm tại **Barangaroo Point Car Park**, địa chỉ **25 Hickson Road, Barangaroo**.',
        'Google Maps: https://share.google/LiueHkocRqNSRvSnZ',
        'Chỉ đi vào đúng bãi **“Barangaroo Point” Wilson Parking**. Không sử dụng **“Bond One”** hoặc bất kỳ bãi Wilson nào khác vì có thể bị phạt.',
        'Chỉ đậu tại các ô **không ghi “RESERVED”**. Nếu tầng B2 đã hết chỗ phù hợp, tiếp tục đi xuống các tầng thấp hơn để tìm ô không dành riêng.',
        'Để vào và ra, giữ **access card** sát **đèn/cảm biến màu xanh** tại cổng.',
        'Boom gate chỉ hoạt động khi hệ thống nhận biết bạn đang **ngồi trong xe**, vì vậy hãy thực hiện thao tác từ bên trong phương tiện.',
        'Bãi xe đóng cửa lúc **12:00 AM / midnight**, nhưng **được phép đậu xe qua đêm**.',
        'Ngoài ra, khu vực gần đó thường có **đậu xe miễn phí trên đường từ khoảng 10:00 PM đến buổi sáng**. Luôn kiểm tra biển báo.',
        '⚠️ **Quan trọng:** access card bị mất hoặc không được trả lại keybox sẽ chịu **phí thay thế $300**, được trừ từ phương thức thanh toán của khách.',
      ],
      instructionsEn: [
        'Parking is located at **Barangaroo Point Car Park**, **25 Hickson Road, Barangaroo**.',
        'Google Maps: https://share.google/LiueHkocRqNSRvSnZ',
        'Use only the designated **“Barangaroo Point” Wilson Parking** location. Do not enter **“Bond One”** or any other Wilson car park, as fines may apply.',
        'Park only in spaces that are **not marked “RESERVED”**. If suitable bays are unavailable on B2, continue down a few levels to find non-reserved spaces.',
        'To enter and exit, hold the **access card** against the **green sensor/light** at the boom gate.',
        'The boom gate operates only while the system detects that you are **inside a vehicle**, so use the access card from inside the car.',
        'The car park closes at **midnight**, but **overnight parking is fully permitted**.',
        'Free street parking is also usually available nearby from approximately **10:00 PM until the morning**. Always check the signs.',
        '⚠️ **Important:** a lost or unreturned access card incurs a **$300 replacement fee**, which will be deducted from the guest’s payment method if it is not returned to the keybox.',
      ],
      messageVi: `Xin chào,\n\nNếu bạn cần đậu xe cho căn **${apartment}**, vui lòng sử dụng **Barangaroo Point Car Park** tại **25 Hickson Road, Barangaroo**:\nhttps://share.google/LiueHkocRqNSRvSnZ\n\nHãy chắc chắn bạn vào đúng bãi **Barangaroo Point Wilson Parking**, không phải **Bond One** hoặc bãi Wilson khác. Chỉ đậu tại các ô **không ghi RESERVED**; nếu cần, hãy tiếp tục xuống các tầng thấp hơn B2 để tìm ô phù hợp.\n\nĐể vào và ra, giữ access card sát **đèn/cảm biến màu xanh** tại cổng. Boom gate chỉ hoạt động khi bạn đang ở trong xe.\n\nBãi xe đóng lúc nửa đêm nhưng được phép đậu qua đêm. Gần đó cũng thường có đậu xe miễn phí trên đường từ khoảng 10:00 PM đến buổi sáng, nhưng vui lòng kiểm tra biển báo.\n\n⚠️ **Quan trọng:** nếu access card bị mất hoặc không được trả lại keybox, phí thay thế **$300** sẽ được trừ từ phương thức thanh toán của bạn.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nIf you require parking for **${apartment}**, please use **Barangaroo Point Car Park** at **25 Hickson Road, Barangaroo**:\nhttps://share.google/LiueHkocRqNSRvSnZ\n\nPlease make sure you enter the designated **Barangaroo Point Wilson Parking** location, not **Bond One** or any other Wilson car park. Park only in spaces that are **not marked RESERVED**; if needed, continue down below B2 to find an available non-reserved bay.\n\nTo enter and exit, hold the access card against the **green sensor/light** at the gate. The boom gate operates only while you are inside a vehicle.\n\nThe car park closes at midnight, but overnight parking is fully permitted. Free street parking is also usually available nearby from around 10:00 PM until the morning, subject to the signs.\n\n⚠️ **Important:** a lost or unreturned access card incurs a **$300 replacement fee**, which will be deducted from your payment method if the card is not returned to the keybox.\n\nThank you.`,
      photos: [
        {
          storagePath: BUILTIN_MILLERS_MANOR_ENTRANCE,
          captionVi: 'Lối vào Barangaroo Point Car Park tại 25 Hickson Road, Barangaroo.',
          captionEn: 'Barangaroo Point Car Park entrance at 25 Hickson Road, Barangaroo.',
          url: builtinPhotoUrl(BUILTIN_MILLERS_MANOR_ENTRANCE),
        },
      ],
    };
  }

  if (
    (normalized.includes('blue horizon') && normalized.includes('$1 million'))
    || normalized.endsWith('blue horizon • $1 million view')
    || normalized.endsWith('blue horizon - $1 million view')
  ) {
    return {
      enabled: true,
      statusVi: 'Cần đăng ký biển số xe',
      statusEn: 'Car plate registration required',
      locationVi: 'Bãi xe trong khuôn viên tòa nhà',
      locationEn: 'On-site building parking',
      accessVi: 'Gửi CAR PLATE để BQL đăng ký trước',
      accessEn: 'Send your CAR PLATE for advance registration',
      spot: '',
      mapUrl: '',
      noteVi: 'Khách cần gửi biển số xe trước khi đến. Nếu chưa biết biển số, vui lòng báo lại để bên mình hỗ trợ.',
      noteEn: 'Please send us your car plate before arrival. If you do not know it yet, let us know.',
      internalNoteVi: 'Cần gửi email đăng ký biển số đến Ban quản lý tòa nhà trước khi khách sử dụng bãi xe. Nội dung này chỉ dành cho đội vận hành và không hiển thị ở Parking Guide của khách.',
      internalNoteEn: 'Email building management to register the guest vehicle before parking. This information is internal only and is not shown in the guest Parking Guide.',
      internalEmailTo: 'harbourside@networkfm.com.au',
      internalEmailSubject: 'Guest parking registration – 28/2A Henry Lawson Avenue – [CAR PLATE]',
      internalEmailBody: `Dear Building Management,\n\nGood day!\n\nPlease be advised that the plate number of our guest at 28/2A Henry Lawson Avenue, for parking registration, is [CAR PLATE], to be parked within the premises of the building starting [CHECK-IN TIME] on [CHECK-IN DATE] until [CHECK-OUT TIME] on [CHECK-OUT DATE]. We trust this information will assist in guiding and accommodating our guests accordingly.\n\nWe sincerely appreciate your kind assistance with the access arrangements.\n\nKind regards,\nNathan’s Team`,
      instructionsVi: [
        'Nếu cần đậu xe, hãy gửi cho bên mình **CAR PLATE / biển số xe**.',
        'Bên mình sẽ chuyển biển số cho **Ban quản lý tòa nhà** để đăng ký quyền vào bãi xe.',
        'Nếu bạn chưa biết biển số xe, vui lòng báo lại cho bên mình.',
        'Chỉ sử dụng bãi xe sau khi bên mình xác nhận việc đăng ký đã được xử lý.',
      ],
      instructionsEn: [
        'If you require parking, please send us your **CAR PLATE**.',
        'We will forward the plate number to **building management** for parking registration.',
        'If you do not know the plate number yet, please let us know.',
        'Please use the building parking only after we confirm that the registration has been arranged.',
      ],
      messageVi: `Xin chào,\n\nDo tòa nhà vừa áp dụng hệ thống boom gate mới, nếu bạn cần đậu xe, vui lòng gửi cho bên mình **CAR PLATE / biển số xe**.\n\nBên mình sẽ chuyển thông tin này đến Ban quản lý tòa nhà để đăng ký quyền đậu xe cho kỳ lưu trú của bạn.\n\nNếu bạn chưa biết biển số xe, vui lòng báo lại cho bên mình.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nAs part of the building's new boom gate system, if you require parking, please send us your **CAR PLATE** so we can forward it to building management for parking registration.\n\nIf you do not know this information yet, please let us know.\n\nThank you.`,
      photos: [],
    };
  }
  return null;
}

function parseParking(apartment: string, rawValue: unknown): ParkingGuideData {
  const fallback = defaultParkingFor(apartment) || emptyParking();
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {};
  const stringValue = (key: keyof ParkingGuideData, defaultValue: string) => hasOwn(raw, key)
    ? String(raw[key] ?? '')
    : defaultValue;
  const stepsValue = (key: 'instructionsVi' | 'instructionsEn', defaultValue: string[]) => hasOwn(raw, key)
    ? (Array.isArray(raw[key]) ? raw[key].map(value => String(value).trim()).filter(Boolean) : [])
    : defaultValue;
  const rawPhotos = hasOwn(raw, 'photos') && Array.isArray(raw.photos) ? raw.photos : fallback.photos;

  return {
    enabled: hasOwn(raw, 'enabled') ? raw.enabled === true : fallback.enabled,
    statusVi: stringValue('statusVi', fallback.statusVi),
    statusEn: stringValue('statusEn', fallback.statusEn),
    locationVi: stringValue('locationVi', fallback.locationVi),
    locationEn: stringValue('locationEn', fallback.locationEn),
    accessVi: stringValue('accessVi', fallback.accessVi),
    accessEn: stringValue('accessEn', fallback.accessEn),
    spot: stringValue('spot', fallback.spot),
    mapUrl: stringValue('mapUrl', fallback.mapUrl),
    noteVi: stringValue('noteVi', fallback.noteVi),
    noteEn: stringValue('noteEn', fallback.noteEn),
    internalNoteVi: stringValue('internalNoteVi', fallback.internalNoteVi) || fallback.internalNoteVi,
    internalNoteEn: stringValue('internalNoteEn', fallback.internalNoteEn) || fallback.internalNoteEn,
    internalEmailTo: stringValue('internalEmailTo', fallback.internalEmailTo) || fallback.internalEmailTo,
    internalEmailSubject: stringValue('internalEmailSubject', fallback.internalEmailSubject) || fallback.internalEmailSubject,
    internalEmailBody: stringValue('internalEmailBody', fallback.internalEmailBody) || fallback.internalEmailBody,
    instructionsVi: stepsValue('instructionsVi', fallback.instructionsVi),
    instructionsEn: stepsValue('instructionsEn', fallback.instructionsEn),
    messageVi: stringValue('messageVi', fallback.messageVi),
    messageEn: stringValue('messageEn', fallback.messageEn),
    photos: rawPhotos
      .filter(value => value && typeof value === 'object')
      .map(value => {
        const photo = value as Record<string, unknown>;
        const storagePath = String(photo.storagePath || '');
        return {
          storagePath,
          captionVi: String(photo.captionVi || photo.caption || ''),
          captionEn: String(photo.captionEn || photo.caption || ''),
          url: builtinPhotoUrl(storagePath),
        };
      })
      .filter(photo => Boolean(photo.storagePath)),
  };
}

function useParkingRecords(active: boolean) {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setRecords([]);
      setLoading(true);
      setError('');
      return;
    }

    let hydrationVersion = 0;
    setLoading(true);
    return onSnapshot(
      collection(db, 'apartments'),
      snapshot => {
        const version = ++hydrationVersion;
        const parsed = snapshot.docs
          .map(snapshotDoc => {
            const value = snapshotDoc.data() as Record<string, unknown>;
            const apartment = String(value.apartment || snapshotDoc.id);
            return {
              id: snapshotDoc.id,
              apartment,
              parking: parseParking(apartment, value.parking),
            } satisfies ParkingRecord;
          })
          .sort((first, second) => first.apartment.localeCompare(second.apartment));

        setRecords(parsed);
        setLoading(false);
        setError('');

        void Promise.all(parsed.map(async record => ({
          ...record,
          parking: {
            ...record.parking,
            photos: await Promise.all(record.parking.photos.map(async photo => {
              if (isBuiltinPhoto(photo.storagePath)) return { ...photo, url: builtinPhotoUrl(photo.storagePath) };
              try {
                return { ...photo, url: await getDownloadURL(ref(storage, photo.storagePath)) };
              } catch {
                return { ...photo, url: '' };
              }
            })),
          },
        }))).then(hydrated => {
          if (version === hydrationVersion) setRecords(hydrated);
        });
      },
      snapshotError => {
        setLoading(false);
        setError(snapshotError.message || 'Unable to load parking guides.');
      },
    );
  }, [active]);

  return { records, loading, error };
}

export default function ParkingExtension() {
  const { canEdit, status } = useApartmentData();
  const { language, text } = useUiLanguage();
  const { records, loading, error } = useParkingRecords(status === 'ready');
  const [parkingActive, setParkingActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'parking');
  const [manageActive, setManageActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'manage');
  const [hosts, setHosts] = useState<{ tabs: HTMLElement; content: HTMLElement } | null>(null);
  const [managerHost, setManagerHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const locate = () => {
      const tab = document.getElementById('tab-checkin');
      const tabs = tab?.parentElement;
      const content = tabs?.parentElement?.nextElementSibling as HTMLElement | null;
      if (tabs && content) {
        content.dataset.appTabContent = 'true';
        setHosts(current => current?.tabs === tabs && current.content === content ? current : { tabs, content });
      }
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleTabClick = (event: MouseEvent) => {
      const tab = event.target instanceof Element ? event.target.closest('[id^="tab-"]') : null;
      if (!tab) return;
      setParkingActive(tab.id === 'tab-parking');
      setManageActive(tab.id === 'tab-manage');
    };
    document.addEventListener('click', handleTabClick);
    return () => document.removeEventListener('click', handleTabClick);
  }, []);

  useEffect(() => {
    if (!hosts || !canEdit || !manageActive) {
      setManagerHost(null);
      document.getElementById('parking-manager-host')?.remove();
      return;
    }

    const placeManagerHost = () => {
      const managementRoot = Array.from(hosts.content.children)
        .find(element => element instanceof HTMLElement && element.classList.contains('space-y-5')) as HTMLElement | undefined;
      if (!managementRoot) return;

      let mount = document.getElementById('parking-manager-host') as HTMLElement | null;
      if (!mount) {
        mount = document.createElement('div');
        mount.id = 'parking-manager-host';
        mount.dataset.parkingManagerHost = 'true';
      }

      const accessSection = Array.from(managementRoot.querySelectorAll(':scope > section'))
        .find(section => section.textContent?.includes('Quyền truy cập')) as HTMLElement | undefined;

      if (accessSection) {
        if (mount.parentElement !== managementRoot || mount.nextElementSibling !== accessSection) {
          managementRoot.insertBefore(mount, accessSection);
        }
      } else if (mount.parentElement !== managementRoot) {
        managementRoot.appendChild(mount);
      }

      setManagerHost(current => current === mount ? current : mount);
    };

    placeManagerHost();
    const observer = new MutationObserver(placeManagerHost);
    observer.observe(hosts.content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [canEdit, hosts, manageActive]);

  useEffect(() => {
    if (parkingActive) {
      document.documentElement.dataset.parkingActive = 'true';
      const url = new URL(location.href);
      url.searchParams.set('tab', 'parking');
      history.replaceState({}, '', url);
    } else {
      delete document.documentElement.dataset.parkingActive;
    }
    return () => delete document.documentElement.dataset.parkingActive;
  }, [parkingActive]);

  if (!hosts) return null;

  return <>
    {createPortal(
      <button
        id="tab-parking"
        type="button"
        onClick={() => { setParkingActive(true); setManageActive(false); }}
        className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-3.5 text-xs font-extrabold shadow-xs transition-all sm:text-sm ${
          parkingActive
            ? 'scale-[1.03] border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <CarFront className={`h-4 w-4 ${parkingActive ? '' : 'text-orange-500'}`} />
        <span className="md:hidden">Parking</span>
        <span className="hidden md:inline">{text('Hướng dẫn đậu xe', 'Parking Guide')}</span>
      </button>,
      hosts.tabs,
    )}

    {parkingActive && createPortal(
      <div data-parking-panel="true">
        <ParkingPanel records={records} loading={loading} error={error} lang={language} />
      </div>,
      hosts.content,
    )}

    {canEdit && manageActive && managerHost && createPortal(
      <div data-parking-manager="true">
        <ParkingManager records={records} loading={loading} error={error} />
      </div>,
      managerHost,
    )}

    <style>{`
      #tab-parking{order:98}
      #tab-manage{order:99}
      html[data-parking-active='true'] [data-app-tab-content='true']>:not([data-parking-panel='true']){display:none!important}
      html[data-parking-active='true'] [id^='tab-']:not(#tab-parking){opacity:.62;transform:none!important;filter:saturate(.45)}
    `}</style>
  </>;
}

function ParkingPanel({ records, loading, error, lang }: { records: ParkingRecord[]; loading: boolean; error: string; lang: Lang }) {
  const guides = useMemo(() => records.filter(record => record.parking.enabled), [records]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('');
  const [copied, setCopied] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ParkingPhoto | null>(null);
  const [copyingPhoto, setCopyingPhoto] = useState('');
  const pngCache = useRef<Map<string, Blob>>(new Map());
  const t = (vi: string, en: string) => pick(lang, vi, en);

  useEffect(() => {
    if (!guides.length) {
      setActiveId('');
      return;
    }
    if (!guides.some(record => record.id === activeId)) setActiveId(guides[0].id);
  }, [activeId, guides]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return guides;
    return guides.filter(record => record.apartment.toLocaleLowerCase().includes(normalized));
  }, [guides, query]);

  const record = guides.find(item => item.id === activeId) || guides[0];
  if (loading) return <LoadingCard label={t('Đang tải hướng dẫn đậu xe…', 'Loading parking guides…')} />;
  if (error) return <ErrorCard message={error} />;
  if (!record) return <EmptyCard message={t('Chưa có căn hộ nào bật Parking Guide.', 'No apartment has Parking Guide enabled yet.')} />;

  const guide = record.parking;
  const steps = lang === 'vi' ? guide.instructionsVi : guide.instructionsEn;
  const message = lang === 'vi' ? guide.messageVi : guide.messageEn;

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(current => current === key ? '' : current), 1800);
  };

  const copyPhoto = async (photo: ParkingPhoto, index: number) => {
    if (!photo.url) return;
    setCopyingPhoto(photo.storagePath);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard is not supported.');
      let png = pngCache.current.get(photo.url);
      if (!png) {
        png = await fetchImageAsPng(photo.url);
        pngCache.current.set(photo.url, png);
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopied(`photo:${index}`);
      window.setTimeout(() => setCopied(current => current === `photo:${index}` ? '' : current), 1800);
    } finally {
      setCopyingPhoto('');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <aside className="lg:col-span-4 xl:col-span-3">
        <div className={`${card} overflow-hidden lg:sticky lg:top-24`}>
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-orange-600">{t('Hỗ trợ khách', 'Guest support')}</p>
                <h2 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">{t('Hướng dẫn đậu xe', 'Parking guides')}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-extrabold dark:bg-slate-800">{guides.length}</span>
            </div>
            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder={t('Tìm căn hộ…', 'Find an apartment…')} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" />
            </label>
          </div>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto p-2 lg:max-h-[calc(100vh-210px)]">
            {filtered.map(item => (
              <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition ${record.id === item.id ? 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200' : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950'}`}>
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[10px] font-extrabold leading-4">{item.apartment}</span>
                  <span className="block truncate text-[9px] opacity-60">{t(item.parking.statusVi, item.parking.statusEn)}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && <p className="p-6 text-center text-[10px] text-slate-400">{t('Không tìm thấy căn hộ.', 'No matching apartment.')}</p>}
          </div>
        </div>
      </aside>

      <main className="space-y-4 lg:col-span-8 xl:col-span-9">
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-orange-50 to-white p-5 dark:border-slate-800 dark:from-orange-950/20 dark:to-slate-900">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-orange-600">{t('Hướng dẫn đang chọn', 'Active parking guide')}</p>
                <h3 className="mt-1 text-base font-extrabold leading-6 text-slate-900 dark:text-white sm:text-lg">{record.apartment}</h3>
                <p className="mt-2 text-[10px] font-bold text-emerald-600">{t(guide.statusVi, guide.statusEn)}</p>
              </div>
              <button type="button" onClick={() => void copyText('guide', message)} disabled={!message} className={`${btn} h-10 shrink-0 bg-orange-600 px-4 text-[10px] text-white disabled:opacity-40`}>
                {copied === 'guide' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'guide' ? t('Đã sao chép', 'Guide copied') : t('Sao chép tin nhắn', 'Copy guest message')}
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            <Info icon={<MapPin className="h-4 w-4" />} label={t('Địa điểm', 'Location')} value={t(guide.locationVi, guide.locationEn)}>
              {guide.mapUrl && <a href={guide.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1.5 text-[9px] font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300"><MapPin className="h-3 w-3" />{t('Mở bản đồ', 'Open map')}<ExternalLink className="h-2.5 w-2.5" /></a>}
            </Info>
            <Info icon={<CarFront className="h-4 w-4" />} label={guide.spot ? t('Vị trí đậu', 'Parking spot') : t('Hình thức', 'Parking type')} value={guide.spot || t(guide.statusVi, guide.statusEn)} />
            <Info icon={<KeyRound className="h-4 w-4" />} label={t('Cách vào bãi xe', 'Access')} value={t(guide.accessVi, guide.accessEn)} />
          </div>

          {(guide.noteVi || guide.noteEn) && <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><b>{t('Lưu ý:', 'Important:')}</b> {t(guide.noteVi, guide.noteEn)}</div>}
        </section>

        {(guide.internalEmailTo || guide.internalEmailSubject || guide.internalEmailBody) && (
          <section className={`${card} overflow-hidden border-violet-200 dark:border-violet-900`}>
            <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white p-5 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-slate-900">
              <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-violet-600 dark:text-violet-400">Internal parking operations</p>
              <h3 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">{t('Email đăng ký parking với Ban quản lý', 'Building management parking email')}</h3>
              <p className="mt-1 text-[9px] leading-4 text-slate-500 dark:text-slate-400">{t('Chỉ dành cho đội vận hành. Không gửi nội dung này cho khách.', 'Internal use only. Do not send this section to the guest.')}</p>
            </div>

            {(guide.internalNoteVi || guide.internalNoteEn) && (
              <div className="mx-5 mt-5 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-[10px] leading-5 text-violet-900 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
                <b>{t('Ghi chú nội bộ:', 'Internal note:')}</b> {t(guide.internalNoteVi, guide.internalNoteEn)}
              </div>
            )}

            <div className="grid gap-3 p-5 md:grid-cols-2">
              <QuickCopyField
                label="Internal email recipient"
                value={guide.internalEmailTo}
                copied={copied === 'internal:recipient'}
                onCopy={() => void copyText('internal:recipient', guide.internalEmailTo)}
              />
              <QuickCopyField
                label="Internal email subject"
                value={guide.internalEmailSubject}
                copied={copied === 'internal:subject'}
                onCopy={() => void copyText('internal:subject', guide.internalEmailSubject)}
              />
              <div className="md:col-span-2">
                <QuickCopyField
                  label="Internal email template"
                  value={guide.internalEmailBody}
                  copied={copied === 'internal:template'}
                  onCopy={() => void copyText('internal:template', guide.internalEmailBody)}
                  multiline
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void copyText('internal:full', [
                    guide.internalEmailTo ? `To: ${guide.internalEmailTo}` : '',
                    guide.internalEmailSubject ? `Subject: ${guide.internalEmailSubject}` : '',
                    guide.internalEmailBody,
                  ].filter(Boolean).join('\n\n'))}
                  className={`${btn} h-10 bg-violet-600 px-4 text-[10px] text-white hover:bg-violet-700`}
                >
                  {copied === 'internal:full' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'internal:full' ? t('Đã sao chép email', 'Full email copied') : t('Sao chép toàn bộ email', 'Copy full internal email')}
                </button>
              </div>
            </div>
          </section>
        )}

        {guide.photos.length > 0 && (
          <section className={`${card} p-5`}>
            <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white"><ImageIcon className="h-4 w-4 text-orange-500" />{t('Hình nhận diện vị trí đậu xe', 'Parking photos')}</h3>
            <p className="mt-1 text-[9px] text-slate-400">{t('Chạm vào ảnh để phóng to hoặc sao chép ảnh vào tin nhắn.', 'Tap an image to enlarge or copy it into a message.')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {guide.photos.map((photo, index) => (
                <article key={`${photo.storagePath}:${index}`} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <button type="button" onClick={() => setSelectedPhoto(photo)} className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {photo.url ? <img src={photo.url} alt={t(photo.captionVi, photo.captionEn)} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-slate-400">Image unavailable</span>}
                    <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[9px] font-extrabold text-white">{index + 1}</span>
                  </button>
                  <div className="p-3">
                    <p className="min-h-8 text-[9px] leading-4 text-slate-500 dark:text-slate-400">{t(photo.captionVi, photo.captionEn)}</p>
                    <button type="button" onClick={() => void copyPhoto(photo, index)} disabled={!photo.url || copyingPhoto === photo.storagePath} className={`${btn} mt-2 h-8 w-full border border-slate-200 bg-white text-[9px] text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`}>
                      {copied === `photo:${index}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copyingPhoto === photo.storagePath ? t('Đang sao chép…', 'Copying…') : copied === `photo:${index}` ? t('Đã sao chép ảnh', 'Image copied') : t('Sao chép ảnh', 'Copy image')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className={`${card} p-5`}>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white"><Sparkles className="h-4 w-4 text-orange-500" />{t('Tin nhắn hướng dẫn từng bước', 'Step-by-step guest message')}</h3>
              <p className="mt-1 text-[9px] text-slate-400">{t('Tên căn hộ được lấy trực tiếp từ cùng bản ghi Apartment Check-in.', 'The apartment name comes directly from the same Apartment Check-in record.')}</p>
            </div>
            <button type="button" onClick={() => void copyText('all', message)} disabled={!message} className={`${btn} h-9 bg-orange-600 px-3 text-[10px] text-white disabled:opacity-40`}>
              {copied === 'all' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'all' ? t('Đã sao chép tất cả', 'All copied') : t('Sao chép toàn bộ', 'Copy full message')}
            </button>
          </div>

          {steps.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <li key={`${lang}:${index}`} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-[9px] font-extrabold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1 whitespace-pre-line text-[11px] leading-5 text-slate-700 dark:text-slate-300"><Rich value={step} /></div>
                  <button type="button" onClick={() => void copyText(`step:${index}`, stripMarkdown(step))} className="h-fit shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-orange-600 dark:border-slate-700 dark:bg-slate-900">
                    {copied === `step:${index}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950">{t('Chưa có các bước hướng dẫn.', 'No parking steps have been added.')}</p>}

          {message && <details className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4 text-[11px] leading-5 dark:border-orange-900/50 dark:bg-orange-950/20"><summary className="cursor-pointer font-extrabold">{t('Xem tin nhắn hoàn chỉnh', 'Preview full message')}</summary><p className="mt-3 whitespace-pre-wrap">{message}</p></details>}
        </section>
      </main>

      {selectedPhoto && (
        <div role="dialog" aria-modal="true" aria-label="Parking photo" onClick={() => setSelectedPhoto(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-8">
          <div onClick={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()} className="relative max-h-full max-w-5xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl">
            <img src={selectedPhoto.url} alt={t(selectedPhoto.captionVi, selectedPhoto.captionEn)} className="max-h-[82vh] w-auto max-w-full object-contain" />
            <button type="button" onClick={() => setSelectedPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80" aria-label="Close image"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParkingManager({ records, loading, error }: { records: ParkingRecord[]; loading: boolean; error: string }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editorVersion, setEditorVersion] = useState(0);

  useEffect(() => {
    if (!selectedId && records[0]) setSelectedId(records[0].id);
    if (selectedId && !records.some(record => record.id === selectedId)) setSelectedId(records[0]?.id || '');
  }, [records, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return records;
    return records.filter(record => record.apartment.toLocaleLowerCase().includes(normalized));
  }, [query, records]);
  const selected = records.find(record => record.id === selectedId) || records[0];

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-orange-200 bg-white shadow-lg shadow-orange-100/60 dark:border-orange-900 dark:bg-slate-900 dark:shadow-none">
      <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white p-4 dark:border-orange-900/50 dark:from-orange-950/30 dark:to-slate-900 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-500/20"><CarFront className="h-5 w-5" /></span>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">Parking Guide editor</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">Chỉnh sửa hướng dẫn đậu xe</h2>
            <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">Parking Guide dùng trực tiếp cùng apartment ID và tên căn hộ của Apartment Check-in. Không tạo thêm tên căn hộ riêng hoặc bản ghi trùng.</p>
          </div>
        </div>
      </div>

      {loading ? <div className="p-5"><LoadingCard label="Loading apartment parking data…" /></div> : error ? <div className="p-5"><ErrorCard message={error} /></div> : records.length === 0 ? <div className="p-5"><EmptyCard message="No apartment data yet." /></div> : (
        <div className="grid gap-5 p-4 lg:grid-cols-[300px_1fr] sm:p-5">
          <aside className="space-y-3">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the same apartment list…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" />
            </label>
            <div className="max-h-[520px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 p-2 dark:border-slate-800">
              {filtered.map(record => (
                <button key={record.id} type="button" onClick={() => { setSelectedId(record.id); setEditorVersion(version => version + 1); }} className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition ${selected?.id === record.id ? 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200' : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950'}`}>
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-3 text-[10px] font-extrabold leading-4">{record.apartment}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-extrabold ${record.parking.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{record.parking.enabled ? 'Parking enabled' : 'Parking disabled'}</span>
                  </span>
                </button>
              ))}
              {filtered.length === 0 && <p className="p-5 text-center text-[10px] text-slate-400">No matching apartment.</p>}
            </div>
          </aside>

          {selected && <ParkingEditor key={`${selected.id}:${editorVersion}`} record={selected} onSaved={() => setEditorVersion(version => version + 1)} />}
        </div>
      )}
    </section>
  );
}

function ParkingEditor({ record, onSaved }: { key?: string; record: ParkingRecord; onSaved: () => void }) {
  const [working, setWorking] = useState<ParkingGuideData>(() => cloneParking(record.parking));
  const [viSteps, setViSteps] = useState(() => stepsToText(record.parking.instructionsVi));
  const [enSteps, setEnSteps] = useState(() => stepsToText(record.parking.instructionsEn));
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pendingRef = useRef<PendingPhoto[]>([]);

  useEffect(() => { pendingRef.current = pendingPhotos; }, [pendingPhotos]);
  useEffect(() => () => pendingRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl)), []);

  const update = <K extends keyof ParkingGuideData>(field: K, value: ParkingGuideData[K]) => setWorking(current => ({ ...current, [field]: value }));

  const addPhotoFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files].filter(file => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024);
    setPendingPhotos(current => [...current, ...accepted.map(file => ({
      file,
      captionVi: file.name.replace(/\.[^.]+$/, ''),
      captionEn: file.name.replace(/\.[^.]+$/, ''),
      previewUrl: URL.createObjectURL(file),
    }))]);
    if (accepted.length !== files.length) setError('Only image files up to 10 MB were added.');
  };

  const removeExistingPhoto = (index: number) => {
    const photo = working.photos[index];
    if (photo && !isBuiltinPhoto(photo.storagePath)) setRemovedPaths(current => [...current, photo.storagePath]);
    update('photos', working.photos.filter((_, photoIndex) => photoIndex !== index));
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos(current => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const uploaded: ParkingPhoto[] = [];
      for (const photo of pendingPhotos) {
        const storagePath = `apartment-media/${record.id}/${crypto.randomUUID()}-parking-${cleanFileName(photo.file.name)}`;
        await uploadBytes(ref(storage, storagePath), photo.file, {
          contentType: photo.file.type || 'image/jpeg',
          customMetadata: { apartmentId: record.id, mediaType: 'parking' },
        });
        uploaded.push({ storagePath, captionVi: photo.captionVi.trim(), captionEn: photo.captionEn.trim() });
      }

      const parking: ParkingGuideData = {
        ...working,
        statusVi: working.statusVi.trim(),
        statusEn: working.statusEn.trim(),
        locationVi: working.locationVi.trim(),
        locationEn: working.locationEn.trim(),
        accessVi: working.accessVi.trim(),
        accessEn: working.accessEn.trim(),
        spot: working.spot.trim(),
        mapUrl: working.mapUrl.trim(),
        noteVi: working.noteVi.trim(),
        noteEn: working.noteEn.trim(),
        internalNoteVi: working.internalNoteVi.trim(),
        internalNoteEn: working.internalNoteEn.trim(),
        internalEmailTo: working.internalEmailTo.trim(),
        internalEmailSubject: working.internalEmailSubject.trim(),
        internalEmailBody: working.internalEmailBody.trim(),
        instructionsVi: textToSteps(viSteps),
        instructionsEn: textToSteps(enSteps),
        messageVi: working.messageVi.trim(),
        messageEn: working.messageEn.trim(),
        photos: [...working.photos.map(({ storagePath, captionVi, captionEn }) => ({ storagePath, captionVi: captionVi.trim(), captionEn: captionEn.trim() })), ...uploaded],
      };

      await setDoc(doc(db, 'apartments', record.id), {
        parking,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email?.toLocaleLowerCase() || '',
      }, { merge: true });

      await Promise.allSettled(removedPaths.filter(path => path && !isBuiltinPhoto(path)).map(path => deleteObject(ref(storage, path))));
      pendingPhotos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
      setRemovedPaths([]);
      setWorking(parking);
      setViSteps(stepsToText(parking.instructionsVi));
      setEnSteps(stepsToText(parking.instructionsEn));
      setMessage('Parking Guide saved successfully. The Parking tab will update automatically.');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save Parking Guide.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-orange-600">Mapped Apartment Check-in record</p>
        <p className="mt-1 text-sm font-extrabold leading-6 text-slate-900 dark:text-white">{record.apartment}</p>
        <p className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">Apartment ID: <code className="rounded bg-white px-1 py-0.5 dark:bg-slate-900">{record.id}</code>. Renaming this apartment in the normal editor automatically changes its name in Parking Guide too.</p>
      </div>

      {(message || error) && <div className={`rounded-xl border p-3 text-[10px] font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{error || message}</div>}

      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
        <span><span className="block text-[10px] font-extrabold text-slate-800 dark:text-slate-200">Enable Parking Guide for this apartment</span><span className="mt-0.5 block text-[9px] text-slate-400">Only enabled apartments appear in the Parking tab.</span></span>
        <input type="checkbox" checked={working.enabled} onChange={event => update('enabled', event.target.checked)} className="h-5 w-5 accent-orange-600" />
      </label>

      <FormSection title="Parking summary">
        <Field label="🇻🇳 Trạng thái" value={working.statusVi} onChange={value => update('statusVi', value)} />
        <Field label="🇬🇧 Status" value={working.statusEn} onChange={value => update('statusEn', value)} />
        <Field label="🇻🇳 Địa điểm" value={working.locationVi} onChange={value => update('locationVi', value)} />
        <Field label="🇬🇧 Location" value={working.locationEn} onChange={value => update('locationEn', value)} />
        <Field label="🇻🇳 Cách vào bãi xe" value={working.accessVi} onChange={value => update('accessVi', value)} />
        <Field label="🇬🇧 Access" value={working.accessEn} onChange={value => update('accessEn', value)} />
        <Field label="Parking spot / Garage number" value={working.spot} onChange={value => update('spot', value)} />
        <Field label="Google Maps URL" value={working.mapUrl} onChange={value => update('mapUrl', value)} />
      </FormSection>

      <FormSection title="Important notes">
        <TextArea label="🇻🇳 Lưu ý quan trọng" value={working.noteVi} onChange={value => update('noteVi', value)} rows={5} />
        <TextArea label="🇬🇧 Important note" value={working.noteEn} onChange={value => update('noteEn', value)} rows={5} />
      </FormSection>

      <FormSection title="Internal note · not shown to guests">
        <div className="col-span-full rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-[10px] leading-5 text-violet-800 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-300">
          Ghi chú vận hành vẫn có thể chỉnh sửa tại đây. Các phần copy nhanh Internal email recipient, subject và template đã được chuyển sang tab Parking Guide của đúng căn hộ.
        </div>
        <TextArea label="🇻🇳 Ghi chú nội bộ" value={working.internalNoteVi} onChange={value => update('internalNoteVi', value)} rows={5} />
        <TextArea label="🇬🇧 Internal note" value={working.internalNoteEn} onChange={value => update('internalNoteEn', value)} rows={5} />
      </FormSection>

      <FormSection title="Step-by-step parking instructions">
        <div className="col-span-full rounded-xl border border-orange-100 bg-orange-50/60 p-3 text-[10px] leading-5 text-orange-800 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-300">Mỗi bước cách nhau bằng một dòng trống, giống Apartment Check-in. Nội dung VI và EN được Copy theo nút ngôn ngữ hiện tại.</div>
        <TextArea label="🇻🇳 HƯỚNG DẪN ĐẬU XE TIẾNG VIỆT" helper="Chừa một dòng trống giữa hai bước." value={viSteps} onChange={value => { setViSteps(value); update('instructionsVi', textToSteps(value)); }} rows={9} />
        <TextArea label="🇬🇧 ENGLISH PARKING INSTRUCTIONS" helper="Leave one blank line between steps." value={enSteps} onChange={value => { setEnSteps(value); update('instructionsEn', textToSteps(value)); }} rows={9} />
      </FormSection>

      <FormSection title="Full guest message">
        <TextArea label="🇻🇳 Tin nhắn hoàn chỉnh để Copy" value={working.messageVi} onChange={value => update('messageVi', value)} rows={11} />
        <TextArea label="🇬🇧 Full guest message to Copy" value={working.messageEn} onChange={value => update('messageEn', value)} rows={11} />
      </FormSection>

      <FormSection title="Parking photos">
        <div className="col-span-full grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {working.photos.map((photo, index) => (
            <ParkingPhotoEditor
              key={`${photo.storagePath}:${index}`}
              src={photo.url || builtinPhotoUrl(photo.storagePath)}
              captionVi={photo.captionVi}
              captionEn={photo.captionEn}
              onCaptionVi={value => update('photos', working.photos.map((item, photoIndex) => photoIndex === index ? { ...item, captionVi: value } : item))}
              onCaptionEn={value => update('photos', working.photos.map((item, photoIndex) => photoIndex === index ? { ...item, captionEn: value } : item))}
              onRemove={() => removeExistingPhoto(index)}
            />
          ))}
          {pendingPhotos.map((photo, index) => (
            <ParkingPhotoEditor
              key={photo.previewUrl}
              src={photo.previewUrl}
              captionVi={photo.captionVi}
              captionEn={photo.captionEn}
              onCaptionVi={value => setPendingPhotos(current => current.map((item, photoIndex) => photoIndex === index ? { ...item, captionVi: value } : item))}
              onCaptionEn={value => setPendingPhotos(current => current.map((item, photoIndex) => photoIndex === index ? { ...item, captionEn: value } : item))}
              onRemove={() => removePendingPhoto(index)}
              isNew
            />
          ))}
          <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-orange-600 transition hover:bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
            <ImagePlus className="h-6 w-6" />
            <span className="mt-2 text-[10px] font-extrabold">Add parking photos</span>
            <span className="mt-1 text-[8px] text-orange-400">JPG, PNG, WebP · max 10 MB</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={event => { addPhotoFiles(event.target.files); event.target.value = ''; }} />
          </label>
        </div>
      </FormSection>

      <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-[10px] font-extrabold text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving Parking Guide…' : 'Save Parking Guide'}
        </button>
      </div>
    </div>
  );
}

function cloneParking(parking: ParkingGuideData): ParkingGuideData {
  return {
    ...parking,
    instructionsVi: [...parking.instructionsVi],
    instructionsEn: [...parking.instructionsEn],
    photos: parking.photos.map(photo => ({ ...photo })),
  };
}

function stepsToText(steps: string[]) {
  return steps.join('\n\n');
}

function textToSteps(value: string) {
  return value.split(/\n\s*\n/g).map(step => step.trim()).filter(Boolean);
}

function cleanFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'parking-image.jpg';
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <div><h3 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-[9px] font-bold text-slate-500 dark:text-slate-400">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" /></label>;
}

function TextArea({ label, helper, value, onChange, rows = 8 }: { label: string; helper?: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label><span className="mb-1 block text-[10px] font-extrabold text-slate-600 dark:text-slate-300">{label}</span>{helper && <span className="mb-2 block text-[9px] leading-4 text-slate-400">{helper}</span>}<textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-base leading-5 text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" /></label>;
}

function ParkingPhotoEditor({ src, captionVi, captionEn, onCaptionVi, onCaptionEn, onRemove, isNew = false }: {
  key?: string;
  src: string;
  captionVi: string;
  captionEn: string;
  onCaptionVi: (value: string) => void;
  onCaptionEn: (value: string) => void;
  onRemove: () => void;
  isNew?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
        {src ? <img src={src} alt={captionEn || captionVi} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] text-slate-400">Loading image…</span>}
        <button type="button" onClick={onRemove} className="absolute right-2 top-2 rounded-full bg-rose-600 p-1.5 text-white shadow"><Trash2 className="h-3 w-3" /></button>
        {isNew && <span className="absolute left-2 top-2 rounded-full bg-orange-600 px-2 py-1 text-[8px] font-extrabold text-white">NEW</span>}
      </div>
      <div className="space-y-1.5 border-t border-slate-200 p-2 dark:border-slate-700">
        <input value={captionVi} onChange={event => onCaptionVi(event.target.value)} placeholder="🇻🇳 Chú thích ảnh" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[9px] outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-900" />
        <input value={captionEn} onChange={event => onCaptionEn(event.target.value)} placeholder="🇬🇧 Photo caption" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[9px] outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-900" />
      </div>
    </article>
  );
}

function QuickCopyField({ label, value, copied, onCopy, multiline = false }: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 dark:border-violet-900/60 dark:bg-violet-950/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400">{label}</p>
        <button type="button" onClick={onCopy} disabled={!value} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 text-[8px] font-extrabold text-white transition hover:bg-violet-700 disabled:opacity-40">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {multiline
        ? <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-violet-100 bg-white p-3 font-sans text-[10px] leading-5 text-slate-700 dark:border-violet-900/50 dark:bg-slate-950 dark:text-slate-300">{value || '—'}</pre>
        : <p className="mt-2 break-words text-[11px] font-semibold leading-5 text-slate-800 dark:text-slate-200">{value || '—'}</p>}
    </div>
  );
}

function Info({ icon, label, value, children }: { icon: ReactNode; label: string; value: string; children?: ReactNode }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70"><div className="flex items-center gap-2 text-orange-600">{icon}<p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div><p className="mt-1.5 text-xs font-bold leading-5 text-slate-800 dark:text-slate-200">{value || '—'}</p>{children}</div>;
}

function LoadingCard({ label }: { label: string }) {
  return <div className={`${card} p-10 text-center`}><Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" /><p className="mt-3 text-xs text-slate-500">{label}</p></div>;
}

function ErrorCard({ message }: { message: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{message}</div>;
}

function EmptyCard({ message }: { message: string }) {
  return <div className={`${card} p-10 text-center`}><CarFront className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-xs text-slate-400">{message}</p></div>;
}

async function fetchImageAsPng(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Image download failed.');
  const source = await response.blob();
  const objectUrl = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The browser could not decode this image.'));
      element.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion failed.');
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG conversion failed.')), 'image/png'));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, '').replace(/`/g, '');
}

function Rich({ value }: { value: string }) {
  return <>{value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">{part.slice(1, -1)}</code>;
    return part;
  })}</>;
}
