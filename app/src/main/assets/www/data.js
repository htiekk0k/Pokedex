// Static reference data: type chart per generation, games per generation, labels.
window.DEXDATA = (() => {
  const TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
    'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

  const TYPE_COLOR = {
    Normal:'#A8A77A', Fire:'#EE8130', Water:'#6390F0', Electric:'#F7D02C', Grass:'#7AC74C',
    Ice:'#96D9D6', Fighting:'#C22E28', Poison:'#A33EA1', Ground:'#E2BF65', Flying:'#A98FF3',
    Psychic:'#F95587', Bug:'#A6B91A', Rock:'#B6A136', Ghost:'#735797', Dragon:'#6F35FC',
    Dark:'#705746', Steel:'#B7B7CE', Fairy:'#D685AD', '???':'#68A090', Stellar:'#40B5A5'
  };
  const LIGHT_TYPES = new Set(['Normal','Electric','Grass','Ice','Ground','Flying','Bug','Rock','Steel','Fairy','Fire','Water','Psychic','Stellar']);

  // Attacking type -> defending type -> multiplier (only non-1 values). Gen 6+ chart.
  const CHART = {
    Normal:{Rock:.5,Ghost:0,Steel:.5},
    Fire:{Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},
    Water:{Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},
    Electric:{Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},
    Grass:{Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},
    Ice:{Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},
    Fighting:{Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2,Fairy:.5},
    Poison:{Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Fairy:2},
    Ground:{Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},
    Flying:{Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},
    Psychic:{Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},
    Bug:{Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5,Fairy:.5},
    Rock:{Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},
    Ghost:{Normal:0,Psychic:2,Ghost:2,Dark:.5},
    Dragon:{Dragon:2,Steel:.5,Fairy:0},
    Dark:{Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Fairy:.5},
    Steel:{Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5,Fairy:2},
    Fairy:{Fire:.5,Fighting:2,Poison:.5,Dragon:2,Dark:2,Steel:.5}
  };

  function typesForGen(gen) {
    if (gen === 1) return TYPES.filter(t => !['Dark','Steel','Fairy'].includes(t));
    if (gen < 6) return TYPES.filter(t => t !== 'Fairy');
    return TYPES.slice();
  }

  function chartForGen(gen) {
    const c = JSON.parse(JSON.stringify(CHART));
    if (gen < 6) { c.Ghost.Steel = .5; c.Dark.Steel = .5; }
    if (gen === 1) {
      c.Bug.Poison = 2; c.Poison.Bug = 2; c.Ghost.Psychic = 0; delete c.Ice.Fire;
    }
    return c;
  }

  function effectiveness(atk, defTypes, gen) {
    const c = chartForGen(gen);
    let m = 1;
    for (const d of defTypes) { const v = (c[atk] || {})[d]; if (v !== undefined) m *= v; }
    return m;
  }

  // Types a Pokémon showed in older generations (used for the list; the detail
  // page uses PokéAPI's own history).
  function typesInGen(types, gen) {
    let t = types.slice();
    if (gen < 6 && t.includes('Fairy')) {
      t = t[0] === 'Fairy' ? ['Normal', ...t.slice(1)] : t.filter(x => x !== 'Fairy');
    }
    if (gen === 1) t = t.filter(x => x !== 'Dark' && x !== 'Steel');
    if (!t.length) t = ['Normal'];
    return [...new Set(t)];
  }

  const ROMAN = ['', 'I','II','III','IV','V','VI','VII','VIII','IX'];
  const GENS = [
    null,
    {region:'Kanto', games:'Red, Blue, Yellow', smogon:'rb', maxNum:151},
    {region:'Johto', games:'Gold, Silver, Crystal', smogon:'gs', maxNum:251},
    {region:'Hoenn', games:'Ruby, Sapphire, Emerald, FireRed, LeafGreen', smogon:'rs', maxNum:386},
    {region:'Sinnoh', games:'Diamond, Pearl, Platinum, HeartGold, SoulSilver', smogon:'dp', maxNum:493},
    {region:'Unova', games:'Black, White, Black 2, White 2', smogon:'bw', maxNum:649},
    {region:'Kalos', games:'X, Y, Omega Ruby, Alpha Sapphire', smogon:'xy', maxNum:721},
    {region:'Alola', games:"Sun, Moon, Ultra Sun, Ultra Moon, Let's Go", smogon:'sm', maxNum:809},
    {region:'Galar', games:'Sword, Shield, Brilliant Diamond, Shining Pearl, Legends: Arceus', smogon:'ss', maxNum:905},
    {region:'Paldea', games:'Scarlet, Violet, Legends: Z-A', smogon:'sv', maxNum:1025}
  ];
  function genOfNum(num) {
    for (let g = 1; g <= 9; g++) if (num <= GENS[g].maxNum) return g;
    return 9;
  }

  // PokéAPI version groups (games) in display order.
  const VG = [
    ['red-blue',1,'Red / Blue'], ['red-green-japan',1,'Red / Green (JP)'], ['blue-japan',1,'Blue (JP)'],
    ['yellow',1,'Yellow'],
    ['gold-silver',2,'Gold / Silver'], ['crystal',2,'Crystal'],
    ['ruby-sapphire',3,'Ruby / Sapphire'], ['emerald',3,'Emerald'], ['firered-leafgreen',3,'FireRed / LeafGreen'],
    ['colosseum',3,'Colosseum'], ['xd',3,'XD'],
    ['diamond-pearl',4,'Diamond / Pearl'], ['platinum',4,'Platinum'], ['heartgold-soulsilver',4,'HeartGold / SoulSilver'],
    ['black-white',5,'Black / White'], ['black-2-white-2',5,'Black 2 / White 2'],
    ['x-y',6,'X / Y'], ['omega-ruby-alpha-sapphire',6,'Omega Ruby / Alpha Sapphire'],
    ['sun-moon',7,'Sun / Moon'], ['ultra-sun-ultra-moon',7,'Ultra Sun / Ultra Moon'],
    ['lets-go-pikachu-lets-go-eevee',7,"Let's Go Pikachu / Eevee"],
    ['sword-shield',8,'Sword / Shield'], ['the-isle-of-armor',8,'Isle of Armor'], ['the-crown-tundra',8,'Crown Tundra'],
    ['brilliant-diamond-shining-pearl',8,'Brilliant Diamond / Shining Pearl'], ['legends-arceus',8,'Legends: Arceus'],
    ['scarlet-violet',9,'Scarlet / Violet'], ['the-teal-mask',9,'The Teal Mask'], ['the-indigo-disk',9,'The Indigo Disk'],
    ['legends-za',9,'Legends: Z-A'], ['mega-dimension',9,'Mega Dimension'], ['champions',9,'Pokémon Champions']
  ];
  const VG_GEN = Object.fromEntries(VG.map(v => [v[0], v[1]]));
  const VG_LABEL = Object.fromEntries(VG.map(v => [v[0], v[2]]));
  const VG_ORDER = Object.fromEntries(VG.map((v, i) => [v[0], i]));

  const VERSION_GEN = {
    red:1, blue:1, yellow:1, 'red-japan':1, 'green-japan':1, 'blue-japan':1,
    gold:2, silver:2, crystal:2,
    ruby:3, sapphire:3, emerald:3, firered:3, leafgreen:3, colosseum:3, xd:3,
    diamond:4, pearl:4, platinum:4, heartgold:4, soulsilver:4,
    black:5, white:5, 'black-2':5, 'white-2':5,
    x:6, y:6, 'omega-ruby':6, 'alpha-sapphire':6,
    sun:7, moon:7, 'ultra-sun':7, 'ultra-moon':7, 'lets-go-pikachu':7, 'lets-go-eevee':7,
    sword:8, shield:8, 'brilliant-diamond':8, 'shining-pearl':8, 'legends-arceus':8,
    scarlet:9, violet:9, 'legends-za':9, champions:9
  };
  const VERSION_LABEL = {
    'red-japan':'Red (JP)', 'green-japan':'Green (JP)', 'blue-japan':'Blue (JP)', firered:'FireRed', leafgreen:'LeafGreen',
    heartgold:'HeartGold', soulsilver:'SoulSilver', 'black-2':'Black 2', 'white-2':'White 2', x:'X', y:'Y',
    'omega-ruby':'Omega Ruby', 'alpha-sapphire':'Alpha Sapphire', 'ultra-sun':'Ultra Sun', 'ultra-moon':'Ultra Moon',
    'lets-go-pikachu':"Let's Go Pikachu", 'lets-go-eevee':"Let's Go Eevee", 'brilliant-diamond':'Brilliant Diamond',
    'shining-pearl':'Shining Pearl', 'legends-arceus':'Legends: Arceus', 'legends-za':'Legends: Z-A', champions:'Pokémon Champions', xd:'XD'
  };

  // Before the physical/special split (Gen 4), the move's type decided its category.
  const PHYSICAL_TYPES = new Set(['Normal','Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel']);

  // Moves whose type changed over time: [until gen, old type]
  const MOVE_TYPE_HISTORY = {
    bite:[1,'Normal'], gust:[1,'Normal'], karatechop:[1,'Normal'], sandattack:[1,'Normal'],
    charm:[5,'Normal'], moonlight:[5,'Normal'], sweetkiss:[5,'Normal'], curse:[4,'???']
  };

  const STAT_KEYS = ['hp','attack','defense','special-attack','special-defense','speed'];
  const STAT_LABEL = {hp:'HP', attack:'Attack', defense:'Defense', 'special-attack':'Sp. Atk', 'special-defense':'Sp. Def', speed:'Speed'};

  const TIER_LABEL = {
    ou:'OU (OverUsed)', ubers:'Ubers', uber:'Ubers', uu:'UU (UnderUsed)', ru:'RU (RarelyUsed)', nu:'NU (NeverUsed)', pu:'PU',
    zu:'ZU (ZeroUsed)', lc:'LC (Little Cup)', nfe:'NFE', uubl:'UUBL', rubl:'RUBL', nubl:'NUBL', publ:'PUBL', zubl:'ZUBL',
    monotype:'Monotype', '1v1':'1v1', '2v2doubles':'2v2 Doubles', almostanyability:'Almost Any Ability',
    anythinggoes:'AG (Anything Goes)', ag:'AG (Anything Goes)', balancedhackmons:'BH (Balanced Hackmons)',
    battlestadiumsingles:'Battle Stadium Singles', battlestadiumdoubles:'Battle Stadium Doubles', cc1v1:'CC1v1 (Challenge Cup 1v1)',
    cap:'CAP (Create-A-Pokémon)', doublesou:'Doubles OU', doublesubers:'Doubles Ubers', doublesuu:'Doubles UU', draft:'Draft',
    godlygift:'Godly Gift', inheritance:'Inheritance', mixandmega:'Mix and Mega', nationaldex:'National Dex',
    nationaldexdoubles:'National Dex Doubles', nationaldexmonotype:'National Dex Monotype', nationaldexru:'National Dex RU',
    nationaldexuu:'National Dex UU', nationaldexubers:'National Dex Ubers', dlc1nationaldexag:'National Dex AG (DLC1)',
    partnersincrime:'Partners in Crime', randombattle:'Random Battle', randomdoublesbattle:'Random Doubles',
    stabmons:'STABmons', ubersuu:'Ubers UU', camomons:'Camomons', purehackmons:'Pure Hackmons', middlecup:'Middle Cup',
    petitcup:'Petit Cup', pikacup:'Pika Cup', nc1997:'Nintendo Cup 1997', nc1999:'Nintendo Cup 1999', stadiumou:'Stadium OU',
    tradebacksou:'Tradebacks OU', lclevel100:'LC Level 100', dreamworldou:'Dream World OU', letsgoou:"Let's Go OU",
    bdspou:'BDSP OU', battlespotsingles:'Battle Spot Singles', battlespotdoubles:'Battle Spot Doubles',
    battlespottriples:'Battle Spot Triples'
  };
  function tierLabel(id) {
    if (TIER_LABEL[id]) return TIER_LABEL[id];
    let m = id.match(/^vgc(\d{4})(.*)$/);
    if (m) return 'VGC ' + m[1] + (m[2] ? ' ' + m[2].replace(/^reg/, 'Reg ').replace(/series/, 'Series ').toUpperCase().replace('REG ', 'Reg ').replace('SERIES ', 'Series ') : '');
    m = id.match(/^bss(.*)$/);
    if (m) return 'Battle Stadium' + (m[1] ? ' ' + m[1].replace(/^reg/, 'Reg ').toUpperCase().replace('REG ', 'Reg ') : '');
    return id.toUpperCase();
  }

  return { TYPES, TYPE_COLOR, LIGHT_TYPES, typesForGen, chartForGen, effectiveness, typesInGen, ROMAN, GENS,
    genOfNum, VG, VG_GEN, VG_LABEL, VG_ORDER, VERSION_GEN, VERSION_LABEL, PHYSICAL_TYPES, MOVE_TYPE_HISTORY,
    STAT_KEYS, STAT_LABEL, tierLabel };
})();
