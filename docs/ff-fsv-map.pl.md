[English](ff-fsv-map.md) · **Polski**

# Mapa FSV instalatora — Immergas Magis Combo V2 + Samsung NASA


Pełna mapa **wszystkich 94 ustawień instalatora FSV** z magistrali Samsung NASA (F1/F2) i ich status **na tej konkretnej instalacji** (Magis Combo V2 Plus + Audax Pro, pętlę prowadzi sterownik Immergasa). Projekt został odchudzony: **docelowo wystawione jest tylko to, co faktycznie działa**; reszta jest **zakomentowana** w pakietach (nie usunięta — zachowana z opisem do wglądu/przywrócenia). Patrz też [ff-control-results.pl.md](ff-control-results.pl.md).

> **Dlaczego tyle wyłączone?** Na Magisie to **Immergas** liczy zadaną (`0x4247`) i prowadzi obieg, pompę i CWU; Samsung jest ślepy na zbiornik CWU (`0x4237`=0) i na pompę (`0x4089`=OFF mimo przepływu). Większość FSV albo jest **nadpisywana**, albo **nieczynna** (brak elementu, którego funkcja potrzebuje), albo dotyczy **sprzętu nieobecnego** na tej instalacji.

## Podsumowanie

- ✅ **Wystawione i działające: 9** — nastawy trybu wyjazdowego 5011–5019 (Konfiguracja). Plus dźwignie **poza FSV** w Sterowaniu: tryb wyjazdowy `0x406D` i FR control `0x40A7`.

- → **Przeniesione do Sterowania: 1** (FR 5051).

- 🔇 **Wyłączone — brak sprzętu: 17** (grzałki, zawór mieszający, strefy, termostaty).

- 🔇 **Wyłączone — nieczynne/nadpisywane: 67** (krzywa, limity, CWU, tryby wymagające styków).


**Razem 94 FSV. Aktywnych encji: 9.**

## Pełna mapa (wszystkie 94)

| FSV | Kod | Nazwa | Grupa | Jednostka | Zakres | Status | Powód |
|---|---|---|---|---|---|---|---|
| 1011 | 0x424A | Maks. temp. wody wyj. (chłodzenie) | 1xxx Limity temperatur | °C | 18…25 (krok 1) | 🔇 Wyłączona — nieczynna | limit temperatury: ignorowany przez Immergas (wlasny setpoint; testy 1031/1032) |
| 1012 | 0x424B | Min. temp. wody wyj. (chłodzenie) | 1xxx Limity temperatur | °C | 5…18 (krok 1) | 🔇 Wyłączona — nieczynna | limit temperatury: ignorowany przez Immergas (wlasny setpoint; testy 1031/1032) |
| 1021 | 0x424C | Maks. temp. pomieszczenia (chłodzenie) | 1xxx Limity temperatur | °C | 28…30 (krok 1) | 🔇 Wyłączona — nieczynna | limit temperatury: ignorowany przez Immergas (wlasny setpoint) |
| 1022 | 0x424D | Min. temp. pomieszczenia (chłodzenie) | 1xxx Limity temperatur | °C | 18…28 (krok 1) | 🔇 Wyłączona — nieczynna | limit temperatury: ignorowany przez Immergas (wlasny setpoint) |
| 1031 | 0x424E | Maks. temp. wody wyj. (ogrzewanie) | 1xxx Limity temperatur | °C | 37…55 (krok 1) | 🔇 Wyłączona — nieczynna | max temp. zasilania nadpisywana przez Immergas (wygrywa setpoint) |
| 1032 | 0x424F | Min. temp. wody wyj. (ogrzewanie) | 1xxx Limity temperatur | °C | 15…37 (krok 1) | 🔇 Wyłączona — nieczynna | min woda wyj. grzanie: ignorowany - 1032=37 nie podnioslo zadanej (stala 24 ponizej min Samsunga) |
| 1041 | 0x4250 | Maks. temp. pomieszczenia (ogrzewanie) | 1xxx Limity temperatur | °C | 18…30 (krok 1) | 🔇 Wyłączona — nieczynna | limit temperatury: ignorowany przez Immergas (wlasny setpoint) |
| 1042 | 0x4251 | Min. temp. pomieszczenia (ogrzewanie) | 1xxx Limity temperatur | °C | 16…18 (krok 1) | 🔇 Wyłączona — nieczynna | limit temperatury: ignorowany przez Immergas (wlasny setpoint) |
| 1051 | 0x4252 | Maks. temp. zbiornika CWU | 1xxx Limity temperatur | °C | 50…70 (krok 1) | 🔇 Wyłączona — nieczynna | limit zbiornika CWU: ignorowany (Immergas liczy; Samsung nie widzi zbiornika) |
| 1052 | 0x4253 | Min. temp. zbiornika CWU | 1xxx Limity temperatur | °C | 30…40 (krok 1) | 🔇 Wyłączona — nieczynna | limit zbiornika CWU: ignorowany (Immergas liczy; Samsung nie widzi zbiornika) |
| 2011 | 0x4254 | Krzywa grzania - temp. zewn. pkt 1 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | -20…5 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa grzania: cala krzywa ignorowana przez Immergas (test WL2 potwierdzil) |
| 2012 | 0x4255 | Krzywa grzania - temp. zewn. pkt 2 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 10…20 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa grzania: cala krzywa ignorowana przez Immergas (test WL2 potwierdzil) |
| 2021 | 0x4256 | Krzywa grzania WL1 - woda wyj. pkt 1 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 17…55 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa grzewcza WL1 ignorowana przez Immergas (wlasny setpoint) |
| 2022 | 0x4257 | Krzywa grzania WL1 - woda wyj. pkt 2 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 17…55 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa grzewcza WL1 ignorowana przez Immergas (wlasny setpoint) |
| 2031 | 0x4258 | Krzywa grzania WL2 - woda wyj. pkt 1 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 17…55 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa grzania WL2: ignorowana przez Immergas |
| 2032 | 0x4259 | Krzywa grzania WL2 - woda wyj. pkt 2 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 17…55 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa grzania WL2: ignorowana przez Immergas |
| 2041 | 0x4093 | Typ krzywej grzania | 2xxx Krzywa grzewcza / chłodzenia (water law) | — | WL1 / WL2 | 🔇 Wyłączona — nieczynna | wybor typu krzywej: ignorowany - WL1->WL2 bez wplywu na zadana |
| 2051 | 0x425A | Krzywa chłodzenia - temp. zewn. pkt 1 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 25…35 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa chlodzenia: ignorowana (Immergas liczy zadana, ten sam mechanizm) |
| 2052 | 0x425B | Krzywa chłodzenia - temp. zewn. pkt 2 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 35…45 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa chlodzenia: ignorowana (Immergas liczy zadana, ten sam mechanizm) |
| 2061 | 0x425C | Krzywa chłodzenia WL1 - woda wyj. pkt 1 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 5…25 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa chlodzenia WL1: ignorowana (ten sam mechanizm) |
| 2062 | 0x425D | Krzywa chłodzenia WL1 - woda wyj. pkt 2 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 5…25 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa chlodzenia WL1: ignorowana (ten sam mechanizm) |
| 2071 | 0x425E | Krzywa chłodzenia WL2 - woda wyj. pkt 1 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 5…25 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa chlodzenia WL2: ignorowana (ten sam mechanizm) |
| 2072 | 0x425F | Krzywa chłodzenia WL2 - woda wyj. pkt 2 | 2xxx Krzywa grzewcza / chłodzenia (water law) | °C | 5…25 (krok 1) | 🔇 Wyłączona — nieczynna | krzywa chlodzenia WL2: ignorowana (ten sam mechanizm) |
| 2081 | 0x4094 | Typ krzywej chłodzenia | 2xxx Krzywa grzewcza / chłodzenia (water law) | — | WL1 / WL2 | 🔇 Wyłączona — nieczynna | wybor typu krzywej chlodzenia: ignorowany (ten sam mechanizm) |
| 2091 | 0x4095 | Termostat zewnętrzny #1 (podłoga) | 2xxx Krzywa grzewcza / chłodzenia (water law) | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | termostat zewnetrzny #1 (podloga): brak termostatu wpietego do Samsunga (pokoj robi Immergas/Salus) - bezczynny |
| 2092 | 0x4096 | Termostat zewnętrzny #2 (klimakonwektor) | 2xxx Krzywa grzewcza / chłodzenia (water law) | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | termostat zewnetrzny #2 (klimakonwektor): brak termostatu wpietego do Samsunga (pokoj robi Immergas/Salus) - bezczynny |
| 2093 | 0x4127 | Sterowanie temp. pokoju z pilota | 2xxx Krzywa grzewcza / chłodzenia (water law) | — | Tylko otoczenie / Krzywa + thermo-off -> pompa wył. / Krzywa + thermo-off -> pompa wł. / Krzywa + thermo-off -> pompa 30% | 🔇 Wyłączona — brak sprzętu | sterowanie temp. pokoju z pilota Samsunga: brak pilota Samsunga (panel emulowany, pokoj robi Immergas) - bezczynny |
| 3011 | 0x4097 | Zbiornik CWU - zastosowanie | 3xxx CWU i dezynfekcja | — | 0 / 1 | 🔇 Wyłączona — nieczynna | CWU: bezczynny - CWU to domena Immergasa (Samsung nie widzi zbiornika) |
| 3021 | 0x4260 | CWU - maks. temp. (pompa ciepła) | 3xxx CWU i dezynfekcja | °C | 45…50 (krok 1) | 🔇 Wyłączona — nieczynna | CWU maks. temp. pompy: zapis trzyma ale bezczynny - Samsung nie widzi zbiornika |
| 3022 | 0x4261 | CWU - różnica wyłączenia pompy | 3xxx CWU i dezynfekcja | °C | 2…10 (krok 1) | 🔇 Wyłączona — nieczynna | CWU: bezczynny - CWU to domena Immergasa (Samsung nie widzi zbiornika) |
| 3023 | 0x4262 | CWU - różnica włączenia pompy | 3xxx CWU i dezynfekcja | °C | 5…20 (krok 1) | 🔇 Wyłączona — nieczynna | CWU: bezczynny - CWU to domena Immergasa (Samsung nie widzi zbiornika) |
| 3024 | 0x4263 | Min. czas ogrzewania przestrzeni | 3xxx CWU i dezynfekcja | min | 1…20 (krok 1) | 🔇 Wyłączona — nieczynna | timer CWU/grzanie: bezczynny - CWU to domena Immergasa |
| 3025 | 0x4264 | Maks. czas dostarczania CWU | 3xxx CWU i dezynfekcja | min | 5…95 (krok 5) | 🔇 Wyłączona — nieczynna | CWU: bezczynny - CWU to domena Immergasa (Samsung nie widzi zbiornika) |
| 3026 | 0x4265 | Maks. czas ogrzewania przestrzeni | 3xxx CWU i dezynfekcja | h | 0.5…10 (krok 0.5) | 🔇 Wyłączona — nieczynna | timer CWU/grzanie: bezczynny - CWU to domena Immergasa |
| 3031 | 0x4098 | Grzałka dodatkowa - zastosowanie | 3xxx CWU i dezynfekcja | — | 0 / 1 | 🔇 Wyłączona — nieczynna | grzalka dodatkowa: bezczynna - grzalki planowane do jednostki wewnetrznej Immergasa, nie Samsunga (przetestowac tylko jesli pojda na strone Samsung/MIM) |
| 3032 | 0x4266 | Grzałka dodatkowa - opóźnienie | 3xxx CWU i dezynfekcja | min | 20…95 (krok 5) | 🔇 Wyłączona — nieczynna | grzalka dodatkowa: bezczynna - grzalki planowane do jednostki wewnetrznej Immergasa, nie Samsunga (przetestowac tylko jesli pojda na strone Samsung/MIM) |
| 3033 | 0x4267 | Grzałka dodatkowa - przeregulowanie | 3xxx CWU i dezynfekcja | °C | 0…4 (krok 1) | 🔇 Wyłączona — nieczynna | grzalka dodatkowa: bezczynna - grzalki planowane do jednostki wewnetrznej Immergasa, nie Samsunga (przetestowac tylko jesli pojda na strone Samsung/MIM) |
| 3041 | 0x4099 | Dezynfekcja | 3xxx CWU i dezynfekcja | — | 0 / 1 | 🔇 Wyłączona — nieczynna | dezynfekcja: bezczynna - Samsung nie widzi zbiornika; robi ja Immergas P15 |
| 3042 | 0x409A | Dezynfekcja - dzień tygodnia | 3xxx CWU i dezynfekcja | — | Niedziela / Poniedziałek / Wtorek / Środa / Czwartek / Piątek / Sobota / Wszystkie dni | 🔇 Wyłączona — nieczynna | grupa dezynfekcji (bezczynna, patrz 3041) |
| 3043 | 0x4269 | Dezynfekcja - godzina rozpoczęcia | 3xxx CWU i dezynfekcja | h | 0…23 (krok 1) | 🔇 Wyłączona — nieczynna | grupa dezynfekcji (bezczynna, patrz 3041) |
| 3044 | 0x426A | Dezynfekcja - temp. docelowa | 3xxx CWU i dezynfekcja | °C | 40…70 (krok 5) | 🔇 Wyłączona — nieczynna | grupa dezynfekcji (bezczynna, patrz 3041) |
| 3045 | 0x426B | Dezynfekcja - czas trwania | 3xxx CWU i dezynfekcja | min | 5…60 (krok 5) | 🔇 Wyłączona — nieczynna | grupa dezynfekcji (bezczynna, patrz 3041) |
| 3046 | 0x42CE | Dezynfekcja - maks. czas | 3xxx CWU i dezynfekcja | h | 0…24 (krok 1) | 🔇 Wyłączona — nieczynna | grupa dezynfekcji (bezczynna, patrz 3041) |
| 3051 | 0x409B | Timer wymuszonego CWU | 3xxx CWU i dezynfekcja | — | 0 / 1 | 🔇 Wyłączona — nieczynna | wymuszone CWU: bezczynny - CWU to domena Immergasa |
| 3052 | 0x426C | Wymuszone CWU - czas trwania | 3xxx CWU i dezynfekcja | min | 30…300 (krok 10) | 🔇 Wyłączona — nieczynna | wymuszone CWU: bezczynny - CWU to domena Immergasa |
| 3061 | 0x409C | Panel słoneczny / termostat CWU | 3xxx CWU i dezynfekcja | — | brak / panel słoneczny / termostat CWU | 🔇 Wyłączona — nieczynna | panel sloneczny/termostat CWU: bezczynny - CWU to domena Immergasa |
| 3071 | 0x409D | Kierunek zaworu CWU | 3xxx CWU i dezynfekcja | — | pomieszczenie / zbiornik | 🔇 Wyłączona — nieczynna | kierunek zaworu CWU: bezczynny - zawor po stronie Immergasa |
| 3081 | 0x42ED | Grzałka dodatkowa - moc stopień 1 | 3xxx CWU i dezynfekcja | kW | 1…6 (krok 1) | 🔇 Wyłączona — nieczynna | moc grzalki: bezczynna - grzalki po stronie Immergasa (przetestowac tylko jesli Samsung/MIM) |
| 3082 | 0x42EE | Grzałka dodatkowa - moc stopień 2 | 3xxx CWU i dezynfekcja | kW | 1…6 (krok 1) | 🔇 Wyłączona — nieczynna | moc grzalki: bezczynna - grzalki po stronie Immergasa (przetestowac tylko jesli Samsung/MIM) |
| 3083 | 0x42EF | Grzałka zbiornika (BSH) - moc | 3xxx CWU i dezynfekcja | kW | 1…6 (krok 1) | 🔇 Wyłączona — nieczynna | moc grzalki zbiornika (BSH): bezczynna - grzalki po stronie Immergasa (przetestowac tylko jesli Samsung/MIM) |
| 4011 | 0x409E | Priorytet ogrzewanie / CWU | 4xxx Ogrzewanie i strefy | — | ciepła woda użytkowa / ogrzewanie | 🔇 Wyłączona — nieczynna | priorytet grzanie/CWU: bezczynny - Immergas prowadzi petle a CWU to w 100% jego domena (Samsung slepy na zbiornik); ten sam mechanizm co testowana pompa/krzywa/limity (nie testowane osobno) |
| 4012 | 0x426D | Temp. zewn. dla priorytetu | 4xxx Ogrzewanie i strefy | °C | -15…20 (krok 1) | 🔇 Wyłączona — nieczynna | temp. zewn. dla priorytetu: bezczynna - o priorytecie decyduje Immergas (patrz 4011) |
| 4013 | 0x426E | Temp. zewn. wyłączenia ogrzewania | 4xxx Ogrzewanie i strefy | °C | 14…35 (krok 1) | 🔇 Wyłączona — nieczynna | temp. zewn. wylaczenia grzania: bezczynna - Immergas liczy zadana i decyduje kiedy grzac; nie do przetestowania tu (zewn. 8,5C ponizej min progu 14C) |
| 4021 | 0x409F | Grzałka zapasowa - zastosowanie | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | grzalka zapasowa - zastosowanie: brak po stronie Samsunga (grzalki ida do jednostki Immergasa) - FSV trzyma ale bezczynny |
| 4022 | 0x40A0 | Priorytet grzałki zapasowej/dodatkowej | 4xxx Ogrzewanie i strefy | — | obie / grzałka zapasowa / grzałka dodatkowa | 🔇 Wyłączona — brak sprzętu | priorytet grzalki zapasowej/dodatkowej: grzalki po stronie Immergasa - FSV trzyma ale bezczynny |
| 4023 | 0x40A1 | Kompensacja niskiej temp. zewn. | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — nieczynna | kompensacja niskiej temp. (grzalka): bezczynna - grzalki po stronie Immergasa |
| 4024 | 0x4270 | Temp. progowa grzałki zapasowej | 4xxx Ogrzewanie i strefy | °C | -15…35 (krok 1) | 🔇 Wyłączona — brak sprzętu | temp. progowa grzalki zapasowej: grzalki po stronie Immergasa - FSV trzyma ale bezczynny |
| 4025 | 0x4271 | Temp. rezerwy przy odszranianiu | 4xxx Ogrzewanie i strefy | °C | 10…55 (krok 5) | 🔇 Wyłączona — brak sprzętu | temp. rezerwy przy odszranianiu: zwiazana z grzalka zapasowa (strona Immergasa) - FSV trzyma ale bezczynny |
| 4031 | 0x40A2 | Bojler zapasowy - zastosowanie | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | bojler zapasowy - zastosowanie: brak na tej instalacji - FSV trzyma ale bezczynny |
| 4032 | 0x40A3 | Priorytet bojlera zapasowego | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | priorytet bojlera zapasowego: brak na tej instalacji - FSV trzyma ale bezczynny |
| 4033 | 0x4272 | Temp. progowa bojlera zapasowego | 4xxx Ogrzewanie i strefy | °C | -20…5 (krok 1) | 🔇 Wyłączona — brak sprzętu | temp. progowa bojlera zapasowego: brak na tej instalacji - FSV trzyma ale bezczynny |
| 4041 | 0x40C0 | Zawór mieszający - zastosowanie | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | zawor mieszajacy - zastosowanie: brak na tej instalacji - FSV trzyma ale bezczynny |
| 4042 | 0x4286 | Zawór miesz. - docelowa ΔT (ogrzewanie) | 4xxx Ogrzewanie i strefy | °C | 5…15 (krok 1) | 🔇 Wyłączona — brak sprzętu | zawor miesz. docelowa dT (grzanie): brak zaworu na tej instalacji - FSV trzyma ale bezczynny |
| 4043 | 0x4287 | Zawór miesz. - docelowa ΔT (chłodzenie) | 4xxx Ogrzewanie i strefy | °C | 5…15 (krok 1) | 🔇 Wyłączona — brak sprzętu | zawor miesz. docelowa dT (chlodzenie): brak zaworu na tej instalacji - FSV trzyma ale bezczynny |
| 4044 | 0x40C1 | Zawór miesz. - współczynnik kontroli | 4xxx Ogrzewanie i strefy | — | 1…5 (krok 1) | 🔇 Wyłączona — brak sprzętu | zawor miesz. wspolczynnik kontroli: brak zaworu na tej instalacji - FSV trzyma ale bezczynny |
| 4045 | 0x4288 | Zawór miesz. - interwał kontroli | 4xxx Ogrzewanie i strefy | min | 1…30 (krok 1) | 🔇 Wyłączona — brak sprzętu | zawor miesz. interwal kontroli: brak zaworu na tej instalacji - FSV trzyma ale bezczynny |
| 4046 | 0x4289 | Zawór miesz. - czas przejścia | 4xxx Ogrzewanie i strefy | s | 60…240 (krok 30) | 🔇 Wyłączona — brak sprzętu | zawor miesz. czas przejscia: brak zaworu na tej instalacji - FSV trzyma ale bezczynny |
| 4051 | 0x40C2 | Pompa inwerterowa - zastosowanie | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — nieczynna | pompa inwerterowa zastosowanie: bezczynne - pompe prowadzi Immergas (potwierdzone testem 4052) |
| 4052 | 0x428A | Pompa inwerterowa - docelowa ΔT | 4xxx Ogrzewanie i strefy | °C | 2…8 (krok 1) | 🔇 Wyłączona — nieczynna | pompa inwerterowa docelowa dT: PRZETESTOWANE bezczynne - 4052 z 5 na 8 nie zmienilo przeplywu (stal 1550 l/h) ani dT (~1,3C); pompa jedzie na stale, Immergas prowadzi obieg, Samsung slepy (0x4089 = OFF mimo 1550 l/h) |
| 4053 | 0x40C3 | Pompa inwerterowa - współczynnik kontroli | 4xxx Ogrzewanie i strefy | — | 1…3 (krok 1) | 🔇 Wyłączona — nieczynna | pompa inwerterowa wspolczynnik kontroli: bezczynny - pompe prowadzi Immergas (potwierdzone testem 4052) |
| 4061 | 0x411A | Sterowanie strefami | 4xxx Ogrzewanie i strefy | — | 0 / 1 | 🔇 Wyłączona — brak sprzętu | sterowanie strefami: zapis trzyma (test 2026-10-28, ON utrzymal sie, cofniety na OFF) ale strefy robi hydraulika Immergasa (KLF08/Salus), nie strona Samsunga - bezczynny |
| 5011 | 0x4273 | Tryb wyjazdowy - woda wyj. chłodzenie | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 5…25 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5012 | 0x4274 | Tryb wyjazdowy - pokój chłodzenie | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 18…30 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5013 | 0x4275 | Tryb wyjazdowy - woda wyj. ogrzewanie | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 15…55 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5014 | 0x4276 | Tryb wyjazdowy - pokój ogrzewanie | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 16…30 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5015 | 0x4277 | Tryb wyjazdowy - auto chłodz. WL1 | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 5…25 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5016 | 0x4278 | Tryb wyjazdowy - auto chłodz. WL2 | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 5…25 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5017 | 0x4279 | Tryb wyjazdowy - auto grzanie WL1 | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 15…55 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5018 | 0x427A | Tryb wyjazdowy - auto grzanie WL2 | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 15…55 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5019 | 0x427B | Tryb wyjazdowy - cel zbiornika CWU | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 30…70 (krok 1) | ✅ Wystawiona — działa | tryb wyjazdowy przejmuje zadaną (potwierdzone) |
| 5021 | 0x427C | CWU oszczędzanie - różnica temp. | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 0…40 (krok 1) | 🔇 Wyłączona — nieczynna | oszcz. CWU roznica temp.: bezczynny - CWU to domena Immergasa (rodzic 5022 bezczynny, Samsung nie widzi zbiornika) |
| 5022 | 0x4128 | Tryb oszczędzania CWU | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Wyłączona — nieczynna | oszcz. CWU: bezczynny - Samsung nie widzi zbiornika, CWU to domena Immergasa |
| 5023 | 0x42F0 | CWU oszcz. - różnica thermo-off | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 0…20 (krok 1) | 🔇 Wyłączona — nieczynna | oszcz. CWU roznica thermo-off: bezczynny - CWU to domena Immergasa (rodzic 5022 bezczynny) |
| 5041 | 0x40A4 | Kontrola szczytu mocy - zastosowanie | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Wyłączona — nieczynna | kontrola szczytu mocy: zapis trzyma ale bezczynny (brak styku szczytu) |
| 5042 | 0x40A5 | Szczyt mocy - wymuszone wyłączenia | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | Wszystko wyłączone / Tylko grzałka dodatkowa / Tylko grzałka zapasowa | 🔇 Wyłączona — nieczynna | szczyt mocy wymuszone wylaczenia: bezczynny - wymaga zewnetrznego styku szczytu (rodzic 5041 bezczynny) |
| 5043 | 0x40A6 | Szczyt mocy - napięcie wejściowe | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | niskie / wysokie | 🔇 Wyłączona — nieczynna | szczyt mocy napiecie wejsciowe: bezczynny - wymaga zewnetrznego styku szczytu (rodzic 5041 bezczynny) |
| 5051 | 0x40A7 | Sterowanie współczynnikiem częstotliwości | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | 0 / 1 | → Sterowanie (działa) | FR control enable - DZIALA (capuje sprezarke ~50%), przełącznik FR w f1f2_control |
| 5081 | 0x411B | Sterowanie PV | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Wyłączona — nieczynna | sterowanie PV: zapis trzyma ale bezczynny (brak styku PV) |
| 5082 | 0x42DB | PV - przesunięcie chłodzenia | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 0…20 (krok 1) | 🔇 Wyłączona — nieczynna | PV przesuniecie chlodzenia: bezczynny - wymaga zewnetrznego styku PV (rodzic 5081 bezczynny) |
| 5083 | 0x42DC | PV - przesunięcie grzania | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 0…20 (krok 1) | 🔇 Wyłączona — nieczynna | PV przesuniecie grzania: bezczynny - wymaga zewnetrznego styku PV (rodzic 5081 bezczynny) |
| 5091 | 0x411C | Sterowanie Smart Grid | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Wyłączona — nieczynna | Smart Grid: zapis trzyma ale bezczynny (brak styku SG) |
| 5092 | 0x42DD | Smart Grid - przesunięcie grzania | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 0…20 (krok 1) | 🔇 Wyłączona — nieczynna | Smart Grid przesuniecie grzania: bezczynny - wymaga zewnetrznego styku SG (rodzic 5091 bezczynny) |
| 5093 | 0x42DE | Smart Grid - przesunięcie CWU | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | °C | 0…20 (krok 1) | 🔇 Wyłączona — nieczynna | Smart Grid przesuniecie CWU: bezczynny - wymaga zewnetrznego styku SG (rodzic 5091 bezczynny) |
| 5094 | 0x411D | Smart Grid - tryb CWU | 5xxx Tryby specjalne (wyjazd, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Wyłączona — nieczynna | Smart Grid tryb CWU: bezczynny - wymaga zewnetrznego styku SG (rodzic 5091 bezczynny) |

---

*Wygenerowane z katalogu FSV projektu (`components/f1f2_nasa/f1f2_fsv_catalog.yaml`). Dźwignie działające (outing, FR) żyją w `f1f2_control`, poza rodziną FSV; edytowalne FSV używają platformy `number` (zob. `f1f2_outing_targets`).*
