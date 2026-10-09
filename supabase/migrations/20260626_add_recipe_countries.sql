-- Expansion catalogue recettes (→ 500) : ajout de 7 cuisines au filtre « pays ».
-- Les options du filtre pays (recipe-panel + recipe-form) sont dérivées
-- dynamiquement de la table taxonomies (domain='country') via useCountries().
-- Ajouter ces lignes suffit : dès qu'une recette publiée porte ce country,
-- l'option apparaît dans le filtre avec son drapeau + label.

INSERT INTO taxonomies (domain, key, labels, metadata, sort_order) VALUES
  ('country', 'jp', '{"fr":"Japon","en":"Japan","es":"Japón","de":"Japan","ja":"日本"}',          '{"flag":"🇯🇵"}', 8),
  ('country', 'cn', '{"fr":"Chine","en":"China","es":"China","de":"China","ja":"中国"}',           '{"flag":"🇨🇳"}', 9),
  ('country', 'kr', '{"fr":"Corée du Sud","en":"South Korea","es":"Corea del Sur","de":"Südkorea","ja":"韓国"}', '{"flag":"🇰🇷"}', 10),
  ('country', 'vn', '{"fr":"Vietnam","en":"Vietnam","es":"Vietnam","de":"Vietnam","ja":"ベトナム"}', '{"flag":"🇻🇳"}', 11),
  ('country', 'mx', '{"fr":"Mexique","en":"Mexico","es":"México","de":"Mexiko","ja":"メキシコ"}',    '{"flag":"🇲🇽"}', 12),
  ('country', 'es', '{"fr":"Espagne","en":"Spain","es":"España","de":"Spanien","ja":"スペイン"}',    '{"flag":"🇪🇸"}', 13),
  ('country', 'gr', '{"fr":"Grèce","en":"Greece","es":"Grecia","de":"Griechenland","ja":"ギリシャ"}', '{"flag":"🇬🇷"}', 14)
ON CONFLICT (domain, key) DO NOTHING;
