export type AirbnbPermission = 'allowed' | 'not-allowed' | 'review';

export interface AgentInfo {
  address: string;
  airbnbNames: string[];
  agency: string;
  email: string;
  agentPermission: AirbnbPermission;
  strataPermission: AirbnbPermission;
  note?: string;
}

export type ResolvedAgentInfo = AgentInfo & {
  overallPermission: AirbnbPermission;
};

const AGENT_INFO: AgentInfo[] = [
  {
    address: '1306/60 Bathurst St',
    airbnbNames: [
      'Luxury 1BDR | Sparkling Harbourside',
      'Luxury 1BDR',
      'Sparkling Harbourside',
      'Marble Enclave | Luxury Convenience',
      'Marble Enclave',
      'Luxury Convenience',
    ],
    agency: 'Citiwise Property',
    email: 'alex.dharma@citiwise.com.au',
    agentPermission: 'not-allowed',
    strataPermission: 'not-allowed',
    note: 'Agent and strata are both marked as not allowing Airbnb.',
  },
  {
    address: '7 Corfu St',
    airbnbNames: [
      'Corfu House | Steps of CBD',
      'Corfu House',
      'Coastal 2-Level Terrace | Harbour Walk',
      'Coastal 2-Level Terrace',
    ],
    agency: 'Rose and Jones',
    email: 'georgia@roseandjones.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '55 Little Mount St',
    airbnbNames: [
      'Brick Enclave | 3BDR Harbour & Casino',
      'Brick Enclave',
      'Bliss Enclave | 3BR Casino Home',
      'Bliss Enclave',
    ],
    agency: 'Grig Property',
    email: 'pm@grig.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '345/243 Pyrmont Street',
    airbnbNames: [
      'City Waterside 1BDR | Casino & Market',
      'City Waterside 1BDR',
    ],
    agency: 'Grig Property',
    email: '',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '35/48 Upper Pitt Street',
    airbnbNames: [
      'Panoramic Escape: Bridge & Opera Gem',
      'Panoramic Escape',
      'Fireworks & Billion $ Views',
    ],
    agency: 'Holmes St Clair',
    email: 'pmaccounts@holmesstclair.com',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '28/2A Henry Lawson Ave',
    airbnbNames: [
      'Blue Horizon • $1 Million View',
      'Blue Horizon',
    ],
    agency: 'Holmes St Clair',
    email: 'pmaccounts@holmesstclair.com',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '17/30 Saunders Street',
    airbnbNames: [
      '3-Floor Penthouse | Casino & Harbor',
      '3-Floor Penthouse',
    ],
    agency: 'Raine Horne Pyrmont',
    email: 'michelle.daoud@cityliving.rh.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '7 Little Mount St',
    airbnbNames: [
      'Casino Enclave | Prime 3BR + Fish Market',
      'Casino Enclave',
    ],
    agency: 'Raine Horne Pyrmont',
    email: 'michelle.daoud@cityliving.rh.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '48 High St',
    airbnbNames: [
      'Millers Manor Terrace | 3BR',
      'Millers Manor Terrace',
      '3BDR Historic Waterside Enclave | Casino',
      '3BDR Historic Waterside Enclave',
    ],
    agency: 'York Property Agents',
    email: 'yorkpropertygroup@mail.propertyme.com',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '32 Bland St',
    airbnbNames: [],
    agency: 'Romic Moore',
    email: 'pm2@romicmoore.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '1409/98 Gloucester St',
    airbnbNames: [
      'Heavens Panorama | Water Views',
      'Heavens Panorama',
    ],
    agency: 'Morton Property',
    email: 'ala.zimmer@morton.com.au',
    agentPermission: 'not-allowed',
    strataPermission: 'not-allowed',
    note: 'Airbnb is not allowed. Nathan is NOT the tenant of this unit.',
  },
  {
    address: '2/122 Kirribilli Ave',
    airbnbNames: [
      'Waterside Enclave Home • $Million view',
      'Waterside Enclave Home',
    ],
    agency: 'Croll Real Estate',
    email: 'Jorge@croll.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '278 Harris St',
    airbnbNames: [
      'Blue Enclave | Casino & Darling Harbour Walk',
      'Blue Enclave',
    ],
    agency: 'Summit International',
    email: 'George@siigroup.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '18/333 Bulwara Road',
    airbnbNames: [],
    agency: 'Seeto Real Estate',
    email: 'rentals1@seetore.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '805/50 Murray St',
    airbnbNames: [
      'Bayside Enclave | Casino & Harbour',
      'Bayside Enclave',
      'Darling Harbour Gem • Pool & Balcony',
      'Darling Harbour Gem',
    ],
    agency: 'LJ Hooker Pyrmont',
    email: 'pm.pyrmont@ljhooker.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '175 Harris Street',
    airbnbNames: [
      'Bliss Terrace City Pad | 2 Balcony',
      'Bliss Terrace City Pad',
    ],
    agency: 'Grig Property',
    email: 'pm@grig.com.au',
    agentPermission: 'not-allowed',
    strataPermission: 'allowed',
    note: 'Agent is marked as not allowing Airbnb; strata is marked as allowed.',
  },
  {
    address: '3002/38 York Street',
    airbnbNames: [
      'Luxury 3BR Skyline | Water Views',
      'Luxury 3BR Skyline',
    ],
    agency: 'PMC',
    email: 'nikki@pmmc.com.au',
    agentPermission: 'review',
    strataPermission: 'not-allowed',
    note: 'Strata is marked as not allowing Airbnb; agent status is marked for review (yellow).',
  },
  {
    address: '110 Sussex Street',
    airbnbNames: [],
    agency: 'Tig Tag Real Estate',
    email: 'rent@tigtagrealestate.com',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
  {
    address: '69 Harris',
    airbnbNames: [],
    agency: 'Raine Horne Pyrmont',
    email: 'michelle.daoud@cityliving.rh.com.au',
    agentPermission: 'allowed',
    strataPermission: 'allowed',
  },
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function overallPermission(info: AgentInfo): AirbnbPermission {
  if (info.agentPermission === 'not-allowed' || info.strataPermission === 'not-allowed') {
    return 'not-allowed';
  }
  if (info.agentPermission === 'allowed' && info.strataPermission === 'allowed') {
    return 'allowed';
  }
  return 'review';
}

export function findAgentInfo(apartmentLabel: string): ResolvedAgentInfo | null {
  const label = normalize(apartmentLabel);
  if (!label) return null;

  let bestMatch: { info: AgentInfo; score: number } | null = null;

  for (const info of AGENT_INFO) {
    const aliases = [info.address, ...info.airbnbNames];
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias || normalizedAlias.length < 6) continue;

      const matches = label.includes(normalizedAlias) || normalizedAlias.includes(label);
      if (!matches) continue;

      const score = Math.min(label.length, normalizedAlias.length);
      if (!bestMatch || score > bestMatch.score) bestMatch = { info, score };
    }
  }

  if (!bestMatch) return null;
  return {
    ...bestMatch.info,
    overallPermission: overallPermission(bestMatch.info),
  };
}
