[English](ff-registers-outside-modbus.md) · **Polski**

# Rejestry F1/F2 NIE sterowane przez magistrale Modbus Immergasa


Lista rejestrów magistrali F1/F2 (katalog `f1f2_nasa`), których **magistrale Modbus Immergasa
(D+/D- i T-/T+) NIE sterują** — to domena jednostki zewnętrznej Samsunga i płytki MIM. Immergas
wysyła tylko żądanie (grzej / nie grzej, zadana), a wartości poniżej ustala samodzielnie firmware
ODU / MIM. Plik komplementarny do `ff-what-immergas-controls.pl.md`.

Podstawa: audyt krzyżowy trzech magistral (2026-10-01), test U11 (2026-10-13), test zapisu (2026-10-22).

Kolumny:
- **źródło** — skąd wartość pojawia się na F1/F2: `ODU` = broadcast 10.00.00→B0.00.FF; `MIM` =
  broadcast 20.00.01→B3.00.FF; `request` = tylko w odpowiedzi na nasz READ (FSV).
- **charakter** — `telemetria` (pomiar, R/O), `aktuator/stan` (ODU steruje elementem), `parametr`
  (ustawienie), `info` (statyczne).

## 1. Jednostka zewnętrzna (ODU, 0x8xxx) — telemetria, tylko do odczytu

| Encja | PDU | źródło | charakter |
|---|---|---|---|
| Temperatura tłoczenia | 0x820A | ODU | telemetria |
| Temperatura skraplacza (wymiennik zewn.) | 0x8218 | ODU | telemetria |
| Temperatura głowicy sprężarki | 0x8280 | ODU | telemetria |
| Temperatura modułu IPM | 0x8254 | ODU | telemetria |
| Zadana temperatura tłoczenia | 0x8223 | ODU | telemetria (cel wyliczany przez ODU) |
| Prąd jednostki zewnętrznej | 0x8217 | ODU | telemetria |
| Napięcie pompy ciepła | 0x24FC | ODU | telemetria |
| Napięcie sieci | 0x82ED | ODU | telemetria |
| Napięcie szyny DC | 0x823B | ODU | telemetria |
| Pobór mocy / moc jedn. zewn. | 0x8413 / 0x8411 | ODU | telemetria |
| Pobrana energia (łącznie) | 0x8414 | ODU | telemetria |
| Moc znamionowa jedn. zewn. | 0x82E3 | ODU | info |
| Liczba jednostek wewnętrznych | 0x0207 | ODU | info |

## 2. Jednostka zewnętrzna — elementy i stany sterowane przez ODU (nie Modbus)

| Encja | PDU | źródło | charakter |
|---|---|---|---|
| Częstotliwość sprężarki (rzeczywista) | 0x8238 | ODU | aktuator (ODU dobiera Hz) |
| Częstotliwość zlecona / docelowa | 0x8236 / 0x8237 | ODU | aktuator |
| Limit częstotliwości 64/95 (naturalny) | 0x8239 | ODU | sterowanie ODU (NIE U11; 19 = U11, patrz ff-what-immergas-controls.pl.md) |
| Obroty wentylatora (zadane / rzeczywiste) | 0x823D / 0x82D9 | ODU | aktuator |
| Pozycja głównego EEV | 0x8229 | ODU | aktuator |
| Zawór 4-drogowy | 0x801A | ODU | aktuator |
| Zawór gorącego gazu | 0x8017 | ODU | aktuator |
| Grzałka tacy ociekowej | 0x80AF | ODU | aktuator (ochrona przed mrozem) |
| Odszranianie | 0x402E | ODU | stan (ODU decyduje) |
| Etap odszraniania | 0x8061 | ODU | stan |
| Etap startu sprężarki | 0x8248 | ODU | stan (logika rozruchu) |
| Blokada ponownego startu | 0x8249 | ODU | stan (ochrona) |
| Sprężarka pracuje | 0x8010 | ODU | stan |
| Tryb pracy jedn. zewn. | 0x8001 | ODU | stan |
| Stan jedn. zewn. (heat/cool) | 0x8003 | ODU | stan |
| Stan wentylatora | 0x800D | ODU | stan |
| Kod błędu / błąd systemu | 0x8235 | ODU | stan |
| Flaga „praca pod nocnym limitem” | 0x80B1 | ODU | stan (skutek U11 — wyzwala Immergas, ale ustawia ODU) |

## 3. Jednostka wewnętrzna / MIM (0x40xx / 0x42xx) niesterowane przez Modbus

| Encja | PDU | źródło | charakter |
|---|---|---|---|
| Pozycja EEV jedn. wewnętrznej | 0x4217 | MIM | aktuator (ODU/MIM) |
| Zawór 2-drogowy | 0x408A | MIM | aktuator |
| Zawór 3-drogowy + położenie | 0x4067 | MIM | aktuator (idzie za żądaniem CWU, ale steruje MIM) |
| Żądana moc jedn. wewnętrznej | 0x4211 | MIM | telemetria |
| Moc znamionowa jedn. wewnętrznej | 0x4212 | MIM | info |
| 0x428D (nośnik U11) | 0x428D | MIM | parametr (wartość pochodzi od Immergasa U11, ale nadaje MIM) |

## 4. Parametry instalatora FSV (94 szt.)

Ustawienia **Samsunga**, odczytywane tylko na nasz READ (`request`). Immergas ich nie ustawia przez
Modbus; co więcej, krzywa wodna FSV (2011–2022) jest na Magisie nieaktywna, bo zadaną wody liczy
krzywa Immergasa. Pełna lista w `components/f1f2_nasa/f1f2_fsv_catalog.yaml` i `PDU_MAP.md`.

| Zakres | PDU | sens |
|---|---|---|
| Limity temperatur 1011–1052 | 0x424A–0x4253 | min/max wody i pokoju (chłodz./grz./CWU) |
| Krzywa wodna 2011–2093 | 0x4254…/0x4093… | krzywa grzewcza/chłodząca (u nas nadpisana przez Immergasa) |
| CWU 3011–3083 | 0x4097…/0x4260… | tryb CWU, histereza, grzałka, dezynfekcja, solar |
| Grzałki / kocioł 4011–4061 | 0x409E…/0x426D… | grzałka wspomagająca, kocioł zapasowy, zawór mieszający, pompa |
| Tryby 5011–5094 | 0x4273…/0x411B… | tryb wyjazdowy, oszczędzanie, szczyt mocy, PV, Smart Grid |

## 5. Firmware / informacje statyczne

| Encja | PDU | źródło |
|---|---|---|
| Firmware jedn. zewnętrznej | 0x0608 (ODU) | ODU |
| EEPROM jedn. zewnętrznej | 0x060C | ODU |
| Firmware falownika | 0x8601 | ODU |
| Firmware jedn. wewnętrznej (MIM) | 0x0608 (indoor) | MIM |

## 6. RAW — nierozszyfrowane, charakter nieznany

0x0402, 0x0411–0x0415, 0x4006, 0x440A, 0x4604 (wewn.); 0x041B, 0x8201, 0x823F, 0x8243, 0x824B,
0x824C, 0x82E1, 0x840F, 0x8417 (zewn.). Nie pochodzą od Immergasa (brak odpowiedników na D+/D- i
T-/T+); do rozszyfrowania snifferem. Szczegóły: `NASA_PDU_crossref.md`, `PDU_MAP.md`.

---

**Uwaga dot. zapisu:** rejestry telemetryczne (charakter „telemetria/info”) są tylko do odczytu —
zapis nic nie da. Rejestry „aktuator/stan” po stronie ODU to parametry pracy sprężarki inwerterowej
(częstotliwość, EEV, zawory, ochrony) — zapis złej wartości grozi uszkodzeniem lub niebezpieczną
pracą. Dlatego nie wskazano tu żadnego z nich jako „bezpiecznego celu zapisu”.
