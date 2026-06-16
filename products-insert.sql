-- ================================================================
-- TCG Iberia â€” Product Catalogue INSERT Statements
-- Generated: 2026-06-15
-- Source: sets.xlsx (With Shrink prices)
-- 25 sets Ã— 2 languages (Japanese + Korean) = 50 products
--
-- Rules applied:
--   name        â†’ "Set | Collection Language"
--   price       â†’ "With Shrink" column
--   discount    â†’ NULL  (no active discount)
--   releaseDate â†’ NULL  (all sets already released)
--   imageUrl    â†’ NULL  (to be uploaded manually)
--   type        â†’ 'Booster Box'
--   stock       â†’ 0
--
-- IDs use md5(random()||clock_timestamp()) to guarantee uniqueness
-- even when statements are executed in the same transaction.
-- ================================================================


-- ================================================================
-- JAPANESE PRODUCTS
-- ================================================================

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Ninja Spinner | M4 Set Booster Box Japanese','ninja-spinner-m4-set-booster-box-japanese',
 'Dynamic ninja-themed booster box expansion set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",1,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Munikis Zero | M3 Booster Box Japanese','munikis-zero-m3-booster-box-japanese',
 'Zero-series legendary booster box collection set.',
 69.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",2,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mega dream EX | M2a Booster Box Japanese','mega-dream-ex-m2a-booster-box-japanese',
 'Mega Dream EX evolution booster box set.',
 129.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",3,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Inferno X | M2 Booster Box Japanese','inferno-x-m2-booster-box-japanese',
 'Blazing Inferno X power expansion booster set.',
 192.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",4,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Abbyss Eye | M5 Booster Box Japanese','abbyss-eye-m5-booster-box-japanese',
 'Dark Abyss Eye mysterious expansion booster set.',
 125.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",5,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mega Brave | M1L Booster Box Japanese','mega-brave-m1l-booster-box-japanese',
 'Mega Brave courageous evolution booster box set.',
 105.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",6,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mega Symphonia | M1S Booster Box Japanese','mega-symphonia-m1s-booster-box-japanese',
 'Melodic Mega Symphonia evolution booster box set.',
 82.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",7,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Black Bolt | SV11b Booster Box Japanese','black-bolt-sv11b-booster-box-japanese',
 'Black Bolt electric power expansion booster set.',
 193.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",8,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'White Flare | SV11w Booster Box Japanese','white-flare-sv11w-booster-box-japanese',
 'White Flare radiant expansion booster box set.',
 180.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",9,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Glory of the Team Rocket | SV10 Booster Box Japanese','glory-of-the-team-rocket-sv10-booster-box-japanese',
 'Team Rocket glory premium expansion booster set.',
 199.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",10,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Battle Partners | SV9 Booster Box Japanese','battle-partners-sv9-booster-box-japanese',
 'Battle Partners teamwork expansion booster box set.',
 79.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",11,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Terastal Festival ex | SV8a Booster Box Japanese','terastal-festival-ex-sv8a-booster-box-japanese',
 'Terastal Festival ex crystal booster box set.',
 175.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",12,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Stella Miracle | SV7 Booster Box Japanese','stella-miracle-sv7-booster-box-japanese',
 'Stellar Miracle shining expansion booster box set.',
 89.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",13,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Night Wanderer | SV6a Booster Box Japanese','night-wanderer-sv6a-booster-box-japanese',
 'Night Wanderer dark mystery expansion booster set.',
 89.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",14,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mask of Transfiguration | SV6 Booster Box Japanese','mask-of-transfiguration-sv6-booster-box-japanese',
 'Transformation Mask mystery expansion booster box set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",15,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Cyber Judge | SV5M Booster Box Japanese','cyber-judge-sv5m-booster-box-japanese',
 'Futuristic Cyber Judge mechanical expansion booster set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",16,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Shiny Treasure Ex | SV4a Booster Box Japanese','shiny-treasure-ex-sv4a-booster-box-japanese',
 'Shiny Treasure ex rare exclusive booster collection.',
 155.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, abundant shiny cards, 1 guaranteed SAR per box',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",17,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Ancient Roar | SV4K Booster Box Japanese','ancient-roar-sv4k-booster-box-japanese',
 'Ancient Roar prehistoric powerful booster box set.',
 89.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",18,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Future Flash | SV4M Booster Box Japanese','future-flash-sv4m-booster-box-japanese',
 'Future Flash time-travel power expansion booster set.',
 85.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",19,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Raging Surf | SV3a Booster Box Japanese','raging-surf-sv3a-booster-box-japanese',
 'Raging Surf ocean-themed expansion booster box set.',
 112.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",20,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Ruler of the black flame | SV3 Booster Box Japanese','ruler-of-the-black-flame-sv3-booster-box-japanese',
 'Ruler of the Black Flame fire booster set.',
 190.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",21,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Snow Hazard | SV2P Booster Box Japanese','snow-hazard-sv2p-booster-box-japanese',
 'Snow Hazard icy terrain expansion booster set.',
 85.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",22,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Clay Burst | SV2D Booster Box Japanese','clay-burst-sv2d-booster-box-japanese',
 'Clay Burst earth-type expansion booster box set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",23,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Violet ex | SV1V Booster Box Japanese','violet-ex-sv1v-booster-box-japanese',
 'Violet ex Scarlet and Violet booster set.',
 79.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",24,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Pokemon 151 | SV2a Booster Box Japanese','pokemon-151-sv2a-booster-box-japanese',
 'Original 151 Pokémon classic booster box collection.',
 450.95,NULL,
 '30 packs per box, 5 cards per pack, all original 151 Pokémon, special retro design, 1 guaranteed SAR per box',
 'Booster Box',NULL,0,NULL,'JAPANESE'::"Language",25,TRUE,0,NOW(),NOW());


-- ================================================================
-- KOREAN PRODUCTS
-- ================================================================

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Ninja Spinner | M4 Set Booster Box Korean','ninja-spinner-m4-set-booster-box-korean',
 'Dynamic ninja-themed booster box expansion set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",1,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Munikis Zero | M3 Booster Box Korean','munikis-zero-m3-booster-box-korean',
 'Zero-series legendary booster box collection set.',
 69.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",2,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mega dream EX | M2a Booster Box Korean','mega-dream-ex-m2a-booster-box-korean',
 'Mega Dream EX evolution booster box set.',
 129.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",3,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Inferno X | M2 Booster Box Korean','inferno-x-m2-booster-box-korean',
 'Blazing Inferno X power expansion booster set.',
 192.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",4,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Abbyss Eye | M5 Booster Box Korean','abbyss-eye-m5-booster-box-korean',
 'Dark Abyss Eye mysterious expansion booster set.',
 125.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",5,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mega Brave | M1L Booster Box Korean','mega-brave-m1l-booster-box-korean',
 'Mega Brave courageous evolution booster box set.',
 105.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",6,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mega Symphonia | M1S Booster Box Korean','mega-symphonia-m1s-booster-box-korean',
 'Melodic Mega Symphonia evolution booster box set.',
 82.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",7,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Black Bolt | SV11b Booster Box Korean','black-bolt-sv11b-booster-box-korean',
 'Black Bolt electric power expansion booster set.',
 193.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",8,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'White Flare | SV11w Booster Box Korean','white-flare-sv11w-booster-box-korean',
 'White Flare radiant expansion booster box set.',
 180.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",9,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Glory of the Team Rocket | SV10 Booster Box Korean','glory-of-the-team-rocket-sv10-booster-box-korean',
 'Team Rocket glory premium expansion booster set.',
 199.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",10,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Battle Partners | SV9 Booster Box Korean','battle-partners-sv9-booster-box-korean',
 'Battle Partners teamwork expansion booster box set.',
 79.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",11,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Terastal Festival ex | SV8a Booster Box Korean','terastal-festival-ex-sv8a-booster-box-korean',
 'Terastal Festival ex crystal booster box set.',
 175.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",12,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Stella Miracle | SV7 Booster Box Korean','stella-miracle-sv7-booster-box-korean',
 'Stellar Miracle shining expansion booster box set.',
 89.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",13,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Night Wanderer | SV6a Booster Box Korean','night-wanderer-sv6a-booster-box-korean',
 'Night Wanderer dark mystery expansion booster set.',
 89.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",14,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Mask of Transfiguration | SV6 Booster Box Korean','mask-of-transfiguration-sv6-booster-box-korean',
 'Transformation Mask mystery expansion booster box set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",15,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Cyber Judge | SV5M Booster Box Korean','cyber-judge-sv5m-booster-box-korean',
 'Futuristic Cyber Judge mechanical expansion booster set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",16,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Shiny Treasure Ex | SV4a Booster Box Korean','shiny-treasure-ex-sv4a-booster-box-korean',
 'Shiny Treasure ex rare exclusive booster collection.',
 155.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, abundant shiny cards, 1 guaranteed SAR per box',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",17,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Ancient Roar | SV4K Booster Box Korean','ancient-roar-sv4k-booster-box-korean',
 'Ancient Roar prehistoric powerful booster box set.',
 89.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",18,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Future Flash | SV4M Booster Box Korean','future-flash-sv4m-booster-box-korean',
 'Future Flash time-travel power expansion booster set.',
 85.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",19,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Raging Surf | SV3a Booster Box Korean','raging-surf-sv3a-booster-box-korean',
 'Raging Surf ocean-themed expansion booster box set.',
 112.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",20,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Ruler of the black flame | SV3 Booster Box Korean','ruler-of-the-black-flame-sv3-booster-box-korean',
 'Ruler of the Black Flame fire booster set.',
 190.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",21,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Snow Hazard | SV2P Booster Box Korean','snow-hazard-sv2p-booster-box-korean',
 'Snow Hazard icy terrain expansion booster set.',
 85.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",22,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Clay Burst | SV2D Booster Box Korean','clay-burst-sv2d-booster-box-korean',
 'Clay Burst earth-type expansion booster box set.',
 99.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",23,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Violet ex | SV1V Booster Box Korean','violet-ex-sv1v-booster-box-korean',
 'Violet ex Scarlet and Violet booster set.',
 79.95,NULL,
 '30 packs per box, 5 cards per pack, 3 guaranteed ARs, 5 exclusives, 5 rares, 1 guaranteed SAR every 5 boxes',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",24,TRUE,0,NOW(),NOW());

INSERT INTO "Product" ("id","name","slug","description","price","discountPercentage","notes","type","releaseDate","stock","imageUrl","language","priority","visible","favoriteCount","createdAt","updatedAt") VALUES
('c'||left(md5(random()::text||clock_timestamp()::text),24),
 'Pokemon 151 | SV2a Booster Box Korean','pokemon-151-sv2a-booster-box-korean',
 'Original 151 Pokémon classic booster box collection.',
 450.95,NULL,
 '30 packs per box, 5 cards per pack, all original 151 Pokémon, special retro design, 1 guaranteed SAR per box',
 'Booster Box',NULL,0,NULL,'KOREAN'::"Language",25,TRUE,0,NOW(),NOW());
