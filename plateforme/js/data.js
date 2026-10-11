/* =====================================================================
   Données d'origine — extraites des fichiers Word du dossier "time tables"
   (L1, L2, L3, M1 Ling, M1 did, M2 Ling, M2 did) — S1 2026-2027.
   Chaque ligne : [niveau(x), jour, début, module, type, groupes, salle, enseignant]
   - niveau(x)  : "M1L+M1D" = cours commun à plusieurs niveaux
   - groupes    : "" = tous les groupes (cours), "G1+G2" = plusieurs groupes
   - salle      : "" = salle absente du document d'origine
   ===================================================================== */
(function (root) {
  const DAYS = ['Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'];
  const SLOTS = ['08:00 - 09:30', '09:30 - 11:00', '11:00 - 12:30', '12:30 - 14:00', '14:00 - 15:30', '15:30 - 17:00'];
  const DAY_IDX = { Sam: 0, Dim: 1, Lun: 2, Mar: 3, Mer: 4, Jeu: 5 };
  const SLOT_IDX = { '08:00': 0, '09:30': 1, '11:00': 2, '12:30': 3, '14:00': 4, '15:30': 5 };

  const LEVELS = [
    { id: 'L1', short: 'L1', name: '1ère année Licence', groups: ['G1', 'G2', 'G3', 'G4'], groupSize: null,
      notes: "Le module « Histoire de l'Algérie » sera dispensé une fois par mois sous forme d'un cours magistral. La date et l'horaire vous seront communiqués ultérieurement." },
    { id: 'L2', short: 'L2', name: '2ème année Licence', groups: ['G1', 'G2', 'G3'], groupSize: null, notes: '' },
    { id: 'L3', short: 'L3', name: '3ème année Licence', groups: ['G1', 'G2', 'G3'], groupSize: null, notes: '' },
    { id: 'M1L', short: 'M1 Ling', name: '1ère année Master Linguistique', groups: ['G1', 'G2'], groupSize: null, notes: '' },
    { id: 'M1D', short: 'M1 Did', name: '1ère année Master Didactique', groups: ['G1', 'G2'], groupSize: null, notes: '' },
    { id: 'M2L', short: 'M2 Ling', name: '2ème année Master Linguistique', groups: ['G1'], groupSize: null, notes: '' },
    { id: 'M2D', short: 'M2 Did', name: '2ème année Master Didactique', groups: ['G1', 'G2'], groupSize: null, notes: '' },
  ];

  // type : Amphi | SM | TD  (catégorie utilisée pour proposer des salles équivalentes)
  const ROOMS = [
    { id: 'A-2', type: 'Amphi' }, { id: 'A-3', type: 'Amphi' }, { id: 'A-4', type: 'Amphi' },
    { id: 'SM-2', type: 'SM' }, { id: 'SM-3', type: 'SM' },
    { id: 'S05', type: 'TD' }, { id: 'S06', type: 'TD' }, { id: 'S08', type: 'TD' }, { id: 'S17', type: 'TD' },
    { id: 'S18', type: 'TD' }, { id: 'S21', type: 'TD' }, { id: 'S27', type: 'TD' }, { id: 'S33', type: 'TD' },
    { id: 'S35', type: 'TD' }, { id: 'S39', type: 'TD' }, { id: 'S41', type: 'TD' },
  ].map(r => Object.assign({ capacity: null, auto: true, blocked: [] }, r));

  const ROWS = [
    // ---------------------------------------------------------------- L1
    ['L1', 'Sam', '09:30', 'Grammaire', 'TD', 'G1', 'S05', 'Belguermi'],
    ['L1', 'Sam', '09:30', 'TIC / E-Learning', 'TD', 'G2', 'S06', 'Saidani'],
    ['L1', 'Sam', '11:00', 'Grammaire', 'TD', 'G2', 'S05', 'Belguermi'],
    ['L1', 'Sam', '11:00', 'TIC / E-Learning', 'TD', 'G1', 'S06', 'Saidani'],
    ['L1', 'Sam', '12:30', 'Grammaire', 'TD', 'G3', 'S05', 'Belguermi'],
    ['L1', 'Sam', '12:30', 'TIC / E-Learning', 'TD', 'G4', 'S06', 'Saidani'],
    ['L1', 'Sam', '14:00', 'Grammaire', 'TD', 'G4', 'S05', 'Belguermi'],
    ['L1', 'Sam', '14:00', 'TIC / E-Learning', 'TD', 'G3', 'S06', 'Saidani'],
    ['L1', 'Dim', '09:30', 'CEO', 'TD', 'G4', 'S05', 'Zaoui'],
    ['L1', 'Dim', '09:30', 'CLE', 'TD', 'G3', 'S17', ''],
    ['L1', 'Dim', '11:00', 'CEO', 'TD', 'G3', 'S05', 'Zaoui'],
    ['L1', 'Dim', '11:00', 'CLE', 'TD', 'G4', 'S41', ''],
    ['L1', 'Dim', '12:30', 'CEO', 'TD', 'G2', 'S05', 'Zaoui'],
    ['L1', 'Dim', '12:30', 'CLE', 'TD', 'G1', 'S41', ''],
    ['L1', 'Dim', '14:00', 'CEO', 'TD', 'G1', 'S05', 'Zaoui'],
    ['L1', 'Dim', '14:00', 'CLE', 'TD', 'G2', 'S41', ''],
    ['L1', 'Lun', '08:00', 'Ling & Phon', 'TD', 'G2', 'S06', 'Tamine'],
    ['L1', 'Lun', '08:00', 'ETL', 'TD', 'G1', 'S05', 'Khalfaoui'],
    ['L1', 'Lun', '09:30', 'Ling & Phon', 'TD', 'G1', 'S06', 'Tamine'],
    ['L1', 'Lun', '09:30', 'ETL', 'TD', 'G2', 'S05', 'Khalfaoui'],
    ['L1', 'Lun', '11:00', 'ETL', 'TD', 'G3', 'S05', 'Khalfaoui'],
    ['L1', 'Lun', '11:00', 'ETL', 'TD', 'G4', 'S06', 'Amara'],
    ['L1', 'Mar', '09:30', 'CEE', 'TD', 'G1', 'S17', 'Chetouane'],
    ['L1', 'Mar', '09:30', 'TTU', 'TD', 'G2', 'S06', ''],
    ['L1', 'Mar', '11:00', 'CEE', 'TD', 'G2', 'S17', 'Chetouane'],
    ['L1', 'Mar', '11:00', 'TTU', 'TD', 'G1', 'S06', ''],
    ['L1', 'Mar', '12:30', 'CEE', 'TD', 'G3', 'S17', 'Chaoui'],
    ['L1', 'Mar', '12:30', 'TTU', 'TD', 'G4', 'S06', ''],
    ['L1', 'Mar', '14:00', 'CEE', 'TD', 'G4', 'S17', 'Chaoui'],
    ['L1', 'Mar', '14:00', 'TTU', 'TD', 'G3', 'S06', ''],
    ['L1', 'Mer', '08:00', 'CLE', 'Cours', '', 'A-4', ''],
    ['L1', 'Mer', '09:30', 'Ling & Phon', 'TD', 'G3', 'S06', 'Tamine'],
    ['L1', 'Mer', '09:30', 'LET', 'TD', 'G4', 'S41', 'Hamadache'],
    ['L1', 'Mer', '11:00', 'Ling & Phon', 'TD', 'G4', 'S06', 'Tamine'],
    ['L1', 'Mer', '11:00', 'LET', 'TD', 'G3', 'S41', 'Hamadache'],
    ['L1', 'Mer', '12:30', 'LET', 'TD', 'G1', 'S41', 'Hamadache'],
    ['L1', 'Mer', '14:00', 'LET', 'TD', 'G2', 'S41', 'Hamadache'],

    // ---------------------------------------------------------------- L2
    ['L2', 'Sam', '09:30', 'Littératies numériques', 'TD', 'G2', 'S27', 'Sidi Saleh'],
    ['L2', 'Sam', '09:30', 'CEE', 'TD', 'G1', 'S21', 'Aissi'],
    ['L2', 'Sam', '11:00', 'Littératies numériques', 'TD', 'G3', 'S27', 'Sidi Saleh'],
    ['L2', 'Sam', '11:00', 'CEE', 'TD', 'G2', 'S21', 'Aissi'],
    ['L2', 'Sam', '12:30', 'Littératies numériques', 'TD', 'G1', 'S27', 'Sidi Saleh'],
    ['L2', 'Sam', '12:30', 'CEE', 'TD', 'G3', 'S21', 'Aissi'],
    ['L2', 'Dim', '09:30', 'Grammaire', 'TD', 'G2', 'S33', 'Benseghir'],
    ['L2', 'Dim', '09:30', 'Lecture et étude de textes', 'TD', 'G1', 'S21', 'Derardja'],
    ['L2', 'Dim', '11:00', 'Grammaire', 'TD', 'G3', 'S33', 'Benseghir'],
    ['L2', 'Dim', '11:00', 'Lecture et étude de textes', 'TD', 'G2', 'S27', 'Derardja'],
    ['L2', 'Dim', '12:30', 'Grammaire', 'TD', 'G1', 'S33', 'Benseghir'],
    ['L2', 'Dim', '12:30', 'Lecture et étude de textes', 'TD', 'G3', 'S17', 'Derardja'],
    ['L2', 'Lun', '08:00', 'CLE', 'Cours', '', 'A-4', 'Bensalah'],
    ['L2', 'Lun', '09:30', 'CEO', 'TD', 'G2', 'S41', 'Aissi'],
    ['L2', 'Lun', '09:30', 'Ling & Phon', 'TD', 'G3', 'S17', 'Benyoucef'],
    ['L2', 'Lun', '09:30', 'CLE', 'TD', 'G1', 'S35', 'Bensalah'],
    ['L2', 'Lun', '11:00', 'CEO', 'TD', 'G3', 'S41', 'Aissi'],
    ['L2', 'Lun', '11:00', 'Ling & Phon', 'TD', 'G1', 'S17', 'Benyoucef'],
    ['L2', 'Lun', '11:00', 'CLE', 'TD', 'G2', 'S35', 'Bensalah'],
    ['L2', 'Lun', '12:30', 'CEO', 'TD', 'G1', 'S41', 'Aissi'],
    ['L2', 'Lun', '12:30', 'Ling & Phon', 'TD', 'G2', 'S17', 'Benyoucef'],
    ['L2', 'Lun', '12:30', 'CLE', 'TD', 'G3', 'S35', 'Bensalah'],
    ['L2', 'Mar', '08:00', 'LLE', 'TD', 'G1', 'S35', 'Khelfaoui'],
    ['L2', 'Mar', '09:30', 'LLE', 'TD', 'G2', 'S35', 'Khelfaoui'],
    ['L2', 'Mar', '09:30', 'TTU', 'TD', 'G1', '', 'Bouguerra'],
    ['L2', 'Mar', '09:30', 'Langue étrangère', 'TD', 'G3', 'S21', 'Bensebbane'],
    ['L2', 'Mar', '11:00', 'LLE', 'TD', 'G3', 'S35', 'Khelfaoui'],
    ['L2', 'Mar', '11:00', 'TTU', 'TD', 'G2', '', 'Bouguerra'],
    ['L2', 'Mar', '11:00', 'Langue étrangère', 'TD', 'G2', 'S21', 'Bensebbane'],
    ['L2', 'Mar', '12:30', 'TTU', 'TD', 'G3', '', 'Bouguerra'],
    ['L2', 'Mar', '12:30', 'Langue étrangère', 'TD', 'G1', 'S21', 'Bensebbane'],

    // ---------------------------------------------------------------- L3
    ['L3', 'Dim', '08:00', 'Linguistique', 'Cours', '', 'A-4', 'Nedjar'],
    ['L3', 'Dim', '09:30', 'LTP', 'TD', 'G1', 'S06', 'Soualah'],
    ['L3', 'Dim', '09:30', "Atelier de lecture & d'écriture", 'TD', 'G3', 'S35', ''],
    ['L3', 'Dim', '11:00', 'LTP', 'TD', 'G2', 'S06', 'Soualah'],
    ['L3', 'Dim', '11:00', "Atelier de lecture & d'écriture", 'TD', 'G1', 'S35', ''],
    ['L3', 'Dim', '12:30', 'LTP', 'TD', 'G3', 'S06', 'Soualah'],
    ['L3', 'Dim', '12:30', "Atelier de lecture & d'écriture", 'TD', 'G2', 'S35', ''],
    ['L3', 'Lun', '09:30', 'LTP', 'Cours', '', 'A-4', 'Soualah'],
    ['L3', 'Lun', '11:00', 'Introduction à la didactique', 'Cours', '', 'A-4', 'Bensalem'],
    ['L3', 'Mar', '08:00', 'Introduction à la didactique', 'TD', 'G2', 'S21', 'Bensalem'],
    ['L3', 'Mar', '08:00', 'Linguistique', 'TD', 'G3', 'S27', 'Benyoucef'],
    ['L3', 'Mar', '08:00', 'Méthodologie', 'TD', 'G1', 'S17', 'Kessour'],
    ['L3', 'Mar', '09:30', 'Introduction à la didactique', 'TD', 'G1', 'S21', 'Bensalem'],
    ['L3', 'Mar', '09:30', 'Linguistique', 'TD', 'G2', 'S27', 'Benyoucef'],
    ['L3', 'Mar', '09:30', 'Méthodologie', 'TD', 'G3', 'S35', 'Kessour'],
    ['L3', 'Mar', '11:00', 'Introduction à la didactique', 'TD', 'G3', 'S21', 'Bensalem'],
    ['L3', 'Mar', '11:00', 'Linguistique', 'TD', 'G1', 'S27', 'Benyoucef'],
    ['L3', 'Mar', '11:00', 'Méthodologie', 'TD', 'G2', 'S35', 'Kessour'],
    ['L3', 'Mer', '08:00', 'Oral', 'TD', 'G1', 'S05', 'Ammari'],
    ['L3', 'Mer', '09:30', 'Oral', 'TD', 'G2', 'S05', 'Ammari'],
    ['L3', 'Mer', '09:30', 'Langue de spécialité', 'TD', 'G1', 'S27', 'Chetouane'],
    ['L3', 'Mer', '11:00', 'Oral', 'TD', 'G3', 'S05', 'Ammari'],
    ['L3', 'Mer', '11:00', 'Langue de spécialité', 'TD', 'G2', 'S27', 'Chetouane'],
    ['L3', 'Mer', '12:30', 'Traduction', 'TD', 'G1', 'S05', 'Bendrimia'],
    ['L3', 'Mer', '12:30', 'CCI', 'TD', 'G2', 'S06', 'Abdelli'],
    ['L3', 'Mer', '12:30', 'Langue de spécialité', 'TD', 'G3', 'S17', 'Chetouane'],
    ['L3', 'Mer', '14:00', 'Traduction', 'TD', 'G2', 'S05', 'Bendrimia'],
    ['L3', 'Mer', '14:00', 'CCI', 'TD', 'G1', 'S06', 'Abdelli'],
    ['L3', 'Jeu', '08:00', 'CCI', 'Cours', '', 'A-4', 'Abdelli'],
    ['L3', 'Jeu', '09:30', 'CCI', 'TD', 'G3', 'S05', 'Abdelli'],
    ['L3', 'Jeu', '11:00', 'Traduction', 'Cours', '', 'A-4', 'Bendrimia'],
    ['L3', 'Jeu', '12:30', 'Traduction', 'TD', 'G3', 'S06', 'Bendrimia'],

    // ---------------------------------------------------------------- M1 Linguistique
    ['M1L', 'Sam', '09:30', 'Théories linguistiques', 'Cours', '', 'SM-3', 'Nedjar'],
    ['M1L', 'Sam', '11:00', 'Théories linguistiques', 'TD', 'G1', 'S21', 'Nedjar'],
    ['M1L', 'Sam', '11:00', 'Logiciels libres et open source', 'TD', 'G2', 'S27', ''],
    ['M1L', 'Sam', '12:30', 'Théories linguistiques', 'TD', 'G2', 'S21', 'Nedjar'],
    ['M1L', 'Sam', '12:30', 'Logiciels libres et open source', 'TD', 'G1', 'S27', ''],
    ['M1L', 'Dim', '09:30', 'Sociolinguistique', 'Cours', '', 'A-4', 'Mousli'],
    ['M1L', 'Dim', '11:00', 'Lexico-sémantique', 'TD', 'G1', 'S17', 'Bahamma'],
    ['M1L', 'Dim', '11:00', 'Sociolinguistique', 'TD', 'G2', 'S27', 'Mousli'],
    ['M1L', 'Dim', '12:30', 'Lexico-sémantique', 'Cours', '', 'A-4', 'Bahamma'],
    ['M1L', 'Dim', '14:00', 'Lexico-sémantique', 'TD', 'G2', 'S17', 'Bahamma'],
    ['M1L', 'Dim', '14:00', 'Sociolinguistique', 'TD', 'G1', 'S35', 'Mousli'],
    ['M1L', 'Lun', '08:00', 'Analyse de discours', 'TD', 'G1', 'S33', 'Miloudi'],
    ['M1L', 'Lun', '09:30', 'Analyse de discours', 'TD', 'G2', 'S27', 'Miloudi'],
    ['M1L', 'Lun', '09:30', 'Techniques rédactionnelles', 'TD', 'G1', 'S21', 'Mouffok'],
    ['M1L', 'Lun', '11:00', 'Analyse de discours', 'Cours', '', 'A-4', 'Miloudi'],
    ['M1L', 'Lun', '12:30', 'Méthodologie', 'Cours', '', 'A-4', 'Mouffok'],
    ['M1L', 'Lun', '14:00', 'Techniques rédactionnelles', 'TD', 'G1', 'S21', 'Mouffok'],
    ['M1L+M1D', 'Mar', '08:00', 'Traduction langue étrangère', 'Cours', '', 'A-4', 'Benmesli'],
    ['M1L', 'Mar', '09:30', 'Traduction langue étrangère', 'TD', 'G1', 'S33', 'Benmesli'],
    ['M1L', 'Mar', '09:30', 'Méthodologie', 'TD', 'G2', 'S27', 'Mouffok'],
    ['M1L', 'Mar', '11:00', 'Traduction langue étrangère', 'TD', 'G2', 'S33', 'Benmesli'],
    ['M1L', 'Mar', '11:00', 'Méthodologie', 'TD', 'G1', 'S27', 'Mouffok'],
    ['M1L', 'Mar', '12:30', 'Éthique & déontologie', 'TD', 'G1+G2', 'SM-3', 'Chetouane'],

    // ---------------------------------------------------------------- M1 Didactique
    ['M1D', 'Dim', '11:00', 'Éthique & déontologie', 'TD', 'G1', 'S06', 'Bensalah'],
    ['M1D', 'Dim', '11:00', 'Traduction langue étrangère', 'TD', 'G2', 'S21', 'Benmesli'],
    ['M1D', 'Dim', '12:30', 'Éthique & déontologie', 'TD', 'G2', 'S06', 'Bensalah'],
    ['M1D', 'Dim', '12:30', 'Traduction langue étrangère', 'TD', 'G1', 'S21', 'Benmesli'],
    ['M1D', 'Lun', '08:00', 'Méthodologie', 'Cours', '', 'SM-3', 'Lahouassa'],
    ['M1D', 'Lun', '09:30', 'Méthodologie', 'TD', 'G1', 'S35', 'Lahouassa'],
    ['M1D', 'Lun', '11:00', 'Méthodologie', 'TD', 'G2', 'S35', 'Lahouassa'],
    ['M1D', 'Lun', '12:30', 'Techniques rédactionnelles', 'TD', 'G1', 'S35', 'Atamna'],
    ['M1D', 'Lun', '14:00', 'Techniques rédactionnelles', 'TD', 'G2', 'S35', 'Atamna'],
    ["M1D", 'Mar', '09:30', "Didactique de l'écrit", 'Cours', '', 'A-4', 'Benboudjema'],
    ['M1D', 'Mar', '11:00', 'Théories & applications de la didactique', 'Cours', '', 'A-4', 'Chaoui'],
    ['M1D', 'Mar', '12:30', "Didactique de l'écrit", 'TD', 'G1', 'S05', 'Benboudjema'],
    ['M1D', 'Mar', '14:00', "Didactique de l'écrit", 'TD', 'G2', 'S05', 'Benboudjema'],
    ['M1D', 'Mer', '11:00', "Didactique de l'oral", 'Cours', '', 'A-4', 'Redjdal'],
    ['M1D', 'Mer', '12:30', 'Théories & applications de la didactique', 'TD', 'G1', 'S18', 'Chaoui'],
    ['M1D', 'Mer', '12:30', "Didactique de l'oral", 'TD', 'G2', 'S27', 'Redjdal'],
    ['M1D', 'Mer', '14:00', 'Théories & applications de la didactique', 'TD', 'G2', 'S18', 'Chaoui'],
    ['M1D', 'Mer', '14:00', "Didactique de l'oral", 'TD', 'G1', 'S27', 'Redjdal'],
    ['M1D', 'Jeu', '08:00', 'Didactique de la grammaire et du lexique', 'Cours', '', 'A-2', 'Bouderhem'],
    ['M1D', 'Jeu', '09:30', 'Didactique de la grammaire et du lexique', 'TD', 'G2', 'S06', ''],
    ['M1D', 'Jeu', '09:30', 'Logiciels libres et open source', 'TD', 'G2', 'S17', ''],
    ['M1D', 'Jeu', '11:00', 'Didactique de la grammaire et du lexique', 'TD', 'G1', 'S06', ''],
    ['M1D', 'Jeu', '11:00', 'Logiciels libres et open source', 'TD', 'G2', 'S17', ''],

    // ---------------------------------------------------------------- M2 Linguistique (groupe unique)
    ['M2L', 'Dim', '08:00', 'Sociolinguistique urbaine', 'Cours', '', 'S17', 'Mousli'],
    ['M2L', 'Dim', '09:30', 'Analyse du discours', 'TD', 'G1', 'S21', 'Miloudi'],
    ['M2L', 'Dim', '11:00', 'Sociolinguistique urbaine', 'TD', 'G1', 'S21', ''],
    ['M2L', 'Dim', '12:30', 'Techniques de rédaction académique', 'TD', 'G1', 'S21', ''],
    ['M2L', 'Lun', '08:00', "Méthodologie de l'écrit universitaire", 'TD', 'G1', 'S17', 'Bahamma'],
    ['M2L', 'Lun', '09:30', 'Pratiques onomastiques', 'Cours', '', 'S17', 'Ammari'],
    ['M2L', 'Lun', '11:00', 'Analyse du discours', 'Cours', '', 'S17', 'Ammari'],
    ['M2L', 'Lun', '12:30', 'Pratiques onomastiques', 'TD', 'G1', 'S27', 'Ammari'],
    ['M2L', 'Mer', '09:30', 'Pragmatique', 'Cours', '', 'S17', 'Benabid'],
    ['M2L', 'Mer', '11:00', 'Pragmatique', 'TD', 'G1', 'S17', 'Benabid'],
    ['M2L', 'Mer', '12:30', 'Genres littéraires', 'TD', 'G1', 'S21', ''],
    ['M2L', 'Mer', '14:00', 'IA', 'TD', 'G1', 'S21', ''],

    // ---------------------------------------------------------------- M2 Didactique
    ['M2D', 'Dim', '09:30', 'Didactique des textes littéraires', 'Cours', '', 'SM-2', 'Lahouassa'],
    ['M2D', 'Dim', '11:00', 'Pratiques évaluatives', 'Cours', '', 'A-3', 'Atamna'],
    ['M2D', 'Dim', '12:30', 'Pratiques évaluatives', 'TD', 'G1', 'S08', 'Atamna'],
    ['M2D', 'Dim', '12:30', 'Didactique des textes littéraires', 'TD', 'G2', 'S27', 'Lahouassa'],
    ['M2D', 'Dim', '14:00', 'Pratiques évaluatives', 'TD', 'G2', 'S08', 'Atamna'],
    ['M2D', 'Dim', '14:00', 'Didactique des textes littéraires', 'TD', 'G1', 'S27', 'Lahouassa'],
    ['M2D', 'Lun', '09:30', 'IA', 'TD', 'G1', 'S39', 'Saidani'],
    ['M2D', 'Lun', '11:00', 'IA', 'TD', 'G2', 'S39', 'Saidani'],
    ['M2D', 'Lun', '12:30', 'Genres littéraires', 'TD', 'G1', 'S33', 'Hamadache'],
    ['M2D', 'Lun', '12:30', "Atelier d'écriture", 'TD', 'G2', 'S06', 'Amara'],
    ['M2D', 'Lun', '14:00', 'Genres littéraires', 'TD', 'G2', 'S33', 'Hamadache'],
    ['M2D', 'Lun', '14:00', "Atelier d'écriture", 'TD', 'G1', 'S06', 'Amara'],
    ['M2D', 'Mar', '09:30', 'Étude des manuels scolaires', 'Cours', '', 'SM-3', 'Bouderhem'],
    ['M2D', 'Mar', '11:00', 'Méthodologie', 'TD', 'G2', 'S18', 'Benboudjema'],
    ['M2D', 'Mar', '11:00', 'Étude des manuels scolaires', 'TD', 'G1', 'S33', 'Bouderhem'],
    ['M2D', 'Mar', '12:30', 'Étude des manuels scolaires', 'TD', 'G2', 'S33', 'Bouderhem'],
    ['M2D', 'Mer', '08:00', 'Traitement de corpus didactique', 'TD', 'G1', 'S35', 'Amara'],
    ['M2D', 'Mer', '09:30', 'Traitement de corpus didactique', 'TD', 'G2', 'S35', 'Amara'],
    ['M2D', 'Mer', '09:30', 'Méthodologie', 'TD', 'G1', 'S21', 'Redjdal'],
    ['M2D', 'Mer', '11:00', 'Traitement de corpus didactique', 'Cours', '', 'SM-3', 'Amara'],
  ];

  const counters = {};
  const SESSIONS = ROWS.map(r => {
    const [lv, d, t, module, type, g, room, teacher] = r;
    const levels = lv.split('+');
    const key = levels[0];
    counters[key] = (counters[key] || 0) + 1;
    return {
      id: key + '-' + String(counters[key]).padStart(3, '0'),
      levels, day: DAY_IDX[d], slot: SLOT_IDX[t], module, type,
      groups: g ? g.split('+') : [], room, teacher, locked: false, note: '',
    };
  });

  // Remarques relevées pendant la lecture des fichiers Word (affichées dans « Conflits & alertes »)
  const IMPORT_NOTES = [
    { level: 'L1', text: 'Samedi 08:00 : texte parasite « HJHJJ » dans la case — ignoré (aucune séance).' },
    { level: 'L2', text: 'Samedi 08:00 : texte parasite « HJHJJ » dans la case — ignoré (aucune séance).' },
    { level: 'L2', text: 'Mardi 09:30 / 11:00 / 12:30 : TTU (G1, G2, G3, Bouguerra) — la salle est incomplète dans le document (« S » sans numéro).' },
    { level: 'L2', text: 'Mardi 11:00 : le groupe G2 a TTU ET Langue étrangère en même temps (erreur dans le document d\'origine). Piste : Langue étrangère G1 à 11:00 et G2 à 12:30.' },
    { level: 'L3', text: 'Lundi 09:30 : enseignant écrit « Soualeh » ; harmonisé en « Soualah » comme dans les TD.' },
    { level: 'M1L', text: 'Lundi 14:00 : Techniques rédactionnelles noté « G1 » alors que G1 a déjà ce TD à 09:30 et que G2 n\'en a aucun — probablement G2 (à vérifier).' },
    { level: 'M1D', text: 'Jeudi 09:30 : Logiciels libres noté « G2 » alors que G2 a déjà Didactique de la grammaire au même moment — probablement G1 (à vérifier).' },
    { level: 'M1L+M1D', text: 'Mardi 08:00 : Traduction langue étrangère (Benmesli, A-4) est un cours commun Ling + Did — fusionné en une seule séance (ce n\'est pas un conflit).' },
    { level: 'M2L', text: 'Dimanche 11:00 : Sociolinguistique urbaine (TD) sans enseignant. Si c\'est Mousli, il/elle a aussi M1 Ling Sociolinguistique G2 au même moment.' },
    { level: '*', text: 'Salles harmonisées : « A-04 » et « Amphi-4 » → A-4 ; « A-02 » → A-2.' },
    { level: '*', text: 'L1 « Khalfaoui » et L2 « Khelfaoui » sont gardés tels quels (orthographe différente — même personne ?).' },
  ];

  const META = {
    university: 'Université Mohamed El Bachir El Ibrahimi — Bordj Bou Arréridj',
    faculty: 'Faculté des Lettres et des Langues',
    department: 'Département de français',
    year: '2026-2027',
    semester: 'S1',
  };

  const ORIGINAL = { version: 1, meta: META, levels: LEVELS, rooms: ROOMS, sessions: SESSIONS };
  const api = { DAYS, SLOTS, ORIGINAL, IMPORT_NOTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EDT_DATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
