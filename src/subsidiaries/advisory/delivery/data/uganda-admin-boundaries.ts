/**
 * Uganda Administrative Boundaries Data
 * Complete list of regions, districts, and sub-counties as of 2024
 */

export interface SubCounty {
  name: string;
  parish?: string[];
}

export interface District {
  name: string;
  subCounties: string[];
}

export interface Region {
  name: string;
  districts: District[];
}

// Uganda Administrative Regions
export const UGANDA_REGIONS: Region[] = [
  {
    name: 'Central Region',
    districts: [
      {
        name: 'Kampala',
        subCounties: [
          'Central Division', 'Kawempe Division', 'Makindye Division',
          'Nakawa Division', 'Rubaga Division'
        ]
      },
      {
        name: 'Wakiso',
        subCounties: [
          'Busukuma', 'Kakiri Town Council', 'Kasanje', 'Kira Town Council',
          'Makindye-Ssabagabo', 'Namayumba', 'Nangabo', 'Nsangi', 'Wakiso Town Council'
        ]
      },
      {
        name: 'Mukono',
        subCounties: [
          'Goma', 'Kasawo', 'Kimenyedde', 'Kyampisi', 'Mukono Town Council',
          'Nama', 'Ntenjeru', 'Ntunda'
        ]
      },
      {
        name: 'Mpigi',
        subCounties: [
          'Buwama', 'Gomba', 'Kabulasoke', 'Kituntu', 'Maddu', 'Mpigi Town Council',
          'Muduma', 'Nkozi'
        ]
      },
      {
        name: 'Luwero',
        subCounties: [
          'Bamunanika', 'Butuntumula', 'Kamira', 'Katikamu', 'Luwero Town Council',
          'Makulubita', 'Nyimbwa', 'Wobulenzi Town Council'
        ]
      },
      {
        name: 'Masaka',
        subCounties: [
          'Buwunga', 'Kabonera', 'Kalungu', 'Kyanamukaaka', 'Masaka Town Council',
          'Mukungwe', 'Nyendo-Mukungwe'
        ]
      },
      {
        name: 'Mubende',
        subCounties: [
          'Bagezza', 'Butoloogo', 'Kassanda', 'Kasambya', 'Kiganda', 'Kitenga',
          'Mubende Town Council', 'Nabingola', 'Madudu'
        ]
      },
      {
        name: 'Rakai',
        subCounties: [
          'Buyamba', 'Ddwaniro', 'Kagamba', 'Kakuuto', 'Kifamba', 'Kyalulangira',
          'Lwamagwa', 'Rakai Town Council'
        ]
      },
      {
        name: 'Kalangala',
        subCounties: [
          'Bufumira', 'Bujumba', 'Kyamuswa', 'Mazinga', 'Mugoye'
        ]
      },
      {
        name: 'Kalungu',
        subCounties: [
          'Bukulula', 'Kalungu Town Council', 'Kyamulibwa', 'Lukaya Town Council'
        ]
      },
      {
        name: 'Lyantonde',
        subCounties: [
          'Kinuuka', 'Kaliiro', 'Kabimbiri', 'Lyantonde Town Council', 'Mpumudde'
        ]
      },
      {
        name: 'Sembabule',
        subCounties: [
          'Lugusulu', 'Lwemiyaga', 'Mateete Town Council', 'Mijwala', 'Sembabule Town Council'
        ]
      }
    ]
  },
  {
    name: 'Eastern Region',
    districts: [
      {
        name: 'Jinja',
        subCounties: [
          'Bugembe', 'Buwenge', 'Jinja Central Division', 'Jinja Eastern Division',
          'Jinja Northern Division', 'Jinja Western Division', 'Kakira Town Council', 'Mafubira'
        ]
      },
      {
        name: 'Mbale',
        subCounties: [
          'Bungokho', 'Bukhalu', 'Busano', 'Buwalasi', 'Industrial Division',
          'Mbale Northern Division', 'Mbale Southern Division', 'Namanyonyi', 'Wanale Division'
        ]
      },
      {
        name: 'Tororo',
        subCounties: [
          'Iyolwa', 'Kirewa', 'Kisoko', 'Kwapa', 'Magola', 'Mella', 'Mulanda',
          'Nagongera', 'Paya', 'Tororo Town Council', 'West Budama North'
        ]
      },
      {
        name: 'Soroti',
        subCounties: [
          'Arapai', 'Gweri', 'Kamuda', 'Katine', 'Kyere', 'Pingire', 'Soroti Town Council',
          'Tubur', 'Eastern Division', 'Western Division'
        ]
      },
      {
        name: 'Iganga',
        subCounties: [
          'Bugweri', 'Bulamogi', 'Busembatia Town Council', 'Iganga Town Council',
          'Kigulu', 'Makuutu', 'Nabitende', 'Namungalwe', 'Nsinze'
        ]
      },
      {
        name: 'Kamuli',
        subCounties: [
          'Balawoli', 'Bugulumbya', 'Bulopa', 'Butansi', 'Buzaaya', 'Kamuli Town Council',
          'Kitayunjwa', 'Nabwigulu', 'Namasagali Town Council', 'Namwiwa'
        ]
      },
      {
        name: 'Busia',
        subCounties: [
          'Buhehe', 'Bulumbi', 'Busia Town Council', 'Busitema', 'Dabani', 'Lunyo',
          'Lumino', 'Masafu Town Council', 'Samia-Bugwe Central', 'Samia-Bugwe North'
        ]
      },
      {
        name: 'Pallisa',
        subCounties: [
          'Agule', 'Butebo', 'Gogonyo', 'Kameke', 'Kibale', 'Pallisa Town Council',
          'Petete', 'Puti-Puti'
        ]
      },
      {
        name: 'Budaka',
        subCounties: [
          'Budaka Town Council', 'Iki-Iki', 'Kamonkoli', 'Kachomo', 'Kadama', 'Lyama'
        ]
      },
      {
        name: 'Kumi',
        subCounties: [
          'Ongino', 'Kanyum', 'Kumi Town Council', 'Mukongoro', 'Nyero', 'Ongino'
        ]
      },
      {
        name: 'Sironko',
        subCounties: [
          'Budadiri Town Council', 'Bukhalu', 'Bukigai', 'Bumasikye', 'Buwalasi',
          'Masaba', 'Sironko Town Council', 'Zesui'
        ]
      },
      {
        name: 'Kapchorwa',
        subCounties: [
          'Chema', 'Kapchorwa Town Council', 'Kapsinda', 'Kongasis', 'Tegeres'
        ]
      },
      {
        name: 'Bukwa',
        subCounties: [
          'Bukwa Town Council', 'Kabei', 'Kamet', 'Kashikish', 'Riwo', 'Suam'
        ]
      },
      {
        name: 'Butaleja',
        subCounties: [
          'Budumba', 'Busolwe Town Council', 'Butaleja Town Council', 'Himutu', 'Kachonga',
          'Mazimasa', 'Naweyo'
        ]
      },
      {
        name: 'Mayuge',
        subCounties: [
          'Baitambogwe', 'Busakira', 'Bukatube', 'Imanyiro', 'Kigandalo', 'Kityerera',
          'Mayuge Town Council', 'Mpungwe', 'Wairasa'
        ]
      }
    ]
  },
  {
    name: 'Northern Region',
    districts: [
      {
        name: 'Gulu',
        subCounties: [
          'Aswa', 'Awach', 'Bardege', 'Bungatira', 'Gulu Town Council', 'Laroo Division',
          'Layibi Division', 'Paicho', 'Palaro', 'Patiko', 'Unyama'
        ]
      },
      {
        name: 'Lira',
        subCounties: [
          'Adekokwok', 'Agweng', 'Amach', 'Aromo', 'Barr', 'Erute', 'Lira Central Division',
          'Lira Eastern Division', 'Lira Western Division', 'Ogur'
        ]
      },
      {
        name: 'Kitgum',
        subCounties: [
          'Kitgum', 'Kitgum Matidi', 'Labongo Akwang', 'Labongo Amida', 'Labongo Layamo',
          'Lagoro', 'Mucwini', 'Namokora', 'Orom', 'Padibe East', 'Padibe West'
        ]
      },
      {
        name: 'Arua',
        subCounties: [
          'Ajia', 'Arua Central Division', 'Arua Hill Division', 'Ayivu East', 'Ayivu West',
          'Dadamu', 'Manibe', 'Oli-vua', 'Pajulu', 'Rhino Camp', 'River Oli', 'Uleppi'
        ]
      },
      {
        name: 'Adjumani',
        subCounties: [
          'Adjumani Town Council', 'Adropi', 'Dzaipi', 'Itirikwa', 'Ofua', 'Pakele'
        ]
      },
      {
        name: 'Moyo',
        subCounties: [
          'Aliba', 'Dufile', 'Gimara', 'Itula', 'Lefori', 'Moyo Town Council', 'Metu'
        ]
      },
      {
        name: 'Nebbi',
        subCounties: [
          'Erussi', 'Jangokoro', 'Nebbi Town Council', 'Nyapea', 'Paidha Town Council',
          'Pakwach Town Council', 'Wadelai'
        ]
      },
      {
        name: 'Apac',
        subCounties: [
          'Abongomola', 'Aduku', 'Akokoro', 'Apac Town Council', 'Chegere', 'Chawente',
          'Ibuje', 'Inomo', 'Loro', 'Maruzi', 'Nambieso'
        ]
      },
      {
        name: 'Pader',
        subCounties: [
          'Acholibur', 'Angagura', 'Atanga', 'Aromo', 'Kilak', 'Laguti', 'Lapul',
          'Pader Town Council', 'Pajule', 'Purongo'
        ]
      },
      {
        name: 'Kotido',
        subCounties: [
          'Kaabong', 'Karenga', 'Kotido Town Council', 'Nakapelimoru', 'Panyangara',
          'Rengen'
        ]
      },
      {
        name: 'Moroto',
        subCounties: [
          'Katikekile', 'Lotome', 'Matheniko', 'Moroto Town Council', 'Nadunget', 'Rupa'
        ]
      },
      {
        name: 'Oyam',
        subCounties: [
          'Aber', 'Acaba', 'Iceme', 'Kamdini', 'Minakulu', 'Myene', 'Ngai', 'Otwal',
          'Oyam Town Council'
        ]
      },
      {
        name: 'Amuru',
        subCounties: [
          'Amuru', 'Atiak Town Council', 'Elegu', 'Lamogi', 'Odek', 'Pabbo', 'Pakwach'
        ]
      },
      {
        name: 'Nwoya',
        subCounties: [
          'Alero', 'Anaka Town Council', 'Koch Goma', 'Purongo'
        ]
      },
      {
        name: 'Lamwo',
        subCounties: [
          'Agoro', 'Lokung', 'Madi Opei', 'Padibe East', 'Padibe West', 'Palabek'
        ]
      }
    ]
  },
  {
    name: 'Western Region',
    districts: [
      {
        name: 'Mbarara',
        subCounties: [
          'Bugamba', 'Bubaare', 'Bukiro', 'Kagongi', 'Kakiika Division', 'Kashari North',
          'Kashari South', 'Katete', 'Mbarara Central Division', 'Mbarara Northern Division',
          'Mbarara Southern Division', 'Rubaya', 'Rwanyamahembe'
        ]
      },
      {
        name: 'Kabale',
        subCounties: [
          'Bukinda', 'Buhara', 'Hamurwa', 'Kabale Central Division', 'Kabale Northern Division',
          'Kabale Southern Division', 'Kaharo', 'Kamuganguzi', 'Kamwezi', 'Kitumba', 'Maziba'
        ]
      },
      {
        name: 'Fort Portal',
        subCounties: [
          'Central Division', 'East Division', 'North Division', 'South Division'
        ]
      },
      {
        name: 'Kasese',
        subCounties: [
          'Bwera', 'Busongora North', 'Busongora South', 'Hima Town Council', 'Kanyangeya',
          'Kasese Municipality', 'Katwe-Kabatoro Town Council', 'Kitswamba', 'Mahango',
          'Maliba', 'Munkunyu', 'Nyakatonzi'
        ]
      },
      {
        name: 'Rukungiri',
        subCounties: [
          'Bitereko', 'Buhunga', 'Buyanja', 'Kebisoni Town Council', 'Nyakishenyi',
          'Nyarushanje', 'Rukungiri Town Council', 'Ruhinda'
        ]
      },
      {
        name: 'Bushenyi',
        subCounties: [
          'Bitooma', 'Bumbaire', 'Bushenyi Town Council', 'Igara East', 'Igara West',
          'Ishaka Division', 'Kyabugimbi', 'Kyeizooba', 'Kyeiyongyera', 'Nyakabirizi Division'
        ]
      },
      {
        name: 'Hoima',
        subCounties: [
          'Bugambe', 'Buhaguzi East', 'Buhaguzi West', 'Buseruka', 'Hoima Central Division',
          'Hoima Eastern Division', 'Hoima Western Division', 'Kabwoya', 'Kigorobya Town Council',
          'Kyangwali'
        ]
      },
      {
        name: 'Ntungamo',
        subCounties: [
          'Bwongyera', 'Itojo', 'Kajara', 'Kayonza', 'Ngoma', 'Ntungamo Town Council',
          'Rubaare Town Council', 'Ruhaama', 'Rukoni'
        ]
      },
      {
        name: 'Kibaale',
        subCounties: [
          'Bugambe', 'Buhimba', 'Buyaga East', 'Buyaga West', 'Kagadi Town Council',
          'Kagadi Division', 'Kibaale Town Council', 'Kakumiro', 'Kiryandongo'
        ]
      },
      {
        name: 'Kabarole',
        subCounties: [
          'Burahya', 'Bukuku', 'Bwamba', 'Harugali', 'Kabonero', 'Kicwamba', 'Mugusu',
          'Rugombe'
        ]
      },
      {
        name: 'Kyenjojo',
        subCounties: [
          'Butiiti', 'Hakibaale', 'Katooke', 'Kyenjojo Town Council', 'Kyarusozi',
          'Mahyoro', 'Mubuku'
        ]
      },
      {
        name: 'Bundibugyo',
        subCounties: [
          'Bubandi', 'Bubukwanga', 'Bundibugyo Town Council', 'Busunga', 'Harugale',
          'Kasitu', 'Sindila'
        ]
      },
      {
        name: 'Kamwenge',
        subCounties: [
          'Bigodi', 'Bwizi', 'Kamwenge Town Council', 'Kanyegaramire', 'Mahyoro', 'Nyabbani'
        ]
      },
      {
        name: 'Ibanda',
        subCounties: [
          'Bisheshe', 'Ibanda Town Council', 'Ibare', 'Ishongororo', 'Kabira',
          'Kicuzi', 'Nyamarebe'
        ]
      },
      {
        name: 'Isingiro',
        subCounties: [
          'Birere', 'Endiinzi', 'Isingiro Town Council', 'Kabingo', 'Kaberebere',
          'Masha', 'Ngarama', 'Rugando'
        ]
      },
      {
        name: 'Kiruhura',
        subCounties: [
          'Bunyaruguru', 'Kashongi', 'Kazo', 'Kenshunga', 'Kinoni', 'Nyakashashara',
          'Sanga'
        ]
      },
      {
        name: 'Sheema',
        subCounties: [
          'Kabwohe Division', 'Kagango', 'Kanyabwanga', 'Kitagata', 'Masheruka',
          'Shuuku'
        ]
      },
      {
        name: 'Mitooma',
        subCounties: [
          'Bitereko', 'Kanyabwanga', 'Kashambya', 'Kanyabwanga', 'Mitooma Town Council',
          'Mutara'
        ]
      },
      {
        name: 'Buhweju',
        subCounties: [
          'Bihanga', 'Burere', 'Engaju', 'Karungu', 'Nsiika'
        ]
      },
      {
        name: 'Rubirizi',
        subCounties: [
          'Buhunga', 'Katerera', 'Ryeru', 'Rubirizi Town Council'
        ]
      }
    ]
  }
];

// Export flattened lists for easy use in dropdowns
export const REGIONS = UGANDA_REGIONS.map(r => r.name);

export const DISTRICTS_BY_REGION: Record<string, string[]> = UGANDA_REGIONS.reduce((acc, region) => {
  acc[region.name] = region.districts.map(d => d.name);
  return acc;
}, {} as Record<string, string[]>);

export const SUBCOUNTIES_BY_DISTRICT: Record<string, string[]> = UGANDA_REGIONS.reduce((acc, region) => {
  region.districts.forEach(district => {
    acc[district.name] = district.subCounties;
  });
  return acc;
}, {} as Record<string, string[]>);

// Get all districts (flattened)
export const ALL_DISTRICTS = UGANDA_REGIONS.flatMap(r => r.districts.map(d => d.name));

// Get all sub-counties (flattened)
export const ALL_SUBCOUNTIES = UGANDA_REGIONS.flatMap(r =>
  r.districts.flatMap(d => d.subCounties)
);

// Helper function to get region by district
export function getRegionByDistrict(districtName: string): string | null {
  for (const region of UGANDA_REGIONS) {
    if (region.districts.some(d => d.name === districtName)) {
      return region.name;
    }
  }
  return null;
}

// Helper function to get district by sub-county
export function getDistrictBySubCounty(subCountyName: string): string | null {
  for (const region of UGANDA_REGIONS) {
    for (const district of region.districts) {
      if (district.subCounties.includes(subCountyName)) {
        return district.name;
      }
    }
  }
  return null;
}
