[English](ff-what-immergas-controls.md) · **Polski**

# Rejestry F1/F2 — co steruje Immergas, a co jednostka zewnętrzna Samsunga


Klasyfikacja wszystkich odczytywanych rejestrów magistrali F1/F2 (katalog komponentu `f1f2_nasa`)
na podstawie naszego configu i logów: audyt krzyżowy trzech magistral (2026-10-01), test funkcji
nocnej U11 (2026-10-13), analiza zadanej temperatury wody, test zapisu 0x428D (2026-10-22).

**„Sterowane przez Immergasa”** = polecenie pochodzi od sterownika Immergasa i jest widoczne/ustawialne
na magistrali **D+/D-** lub **T-/T+**. Zapis na F1/F2 walczyłby wtedy z piecem (udowodnione: zapisy do
jednostki wewnętrznej „idą w próżnię”, skierowany zapis 0x428D do ODU zignorowany).

## A. Sterowane / zadawane przez sterownik Immergasa (D+/D-, T-/T+)

| Encja | PDU | Czym steruje Immergas / dowód |
|---|---|---|
| Zadana temperatura wody (aktywna) | 0x4247 | krzywa Immergasa R02–R05 + offset U03; = D04 na D+/D- i T-/T+ |
| Zadana temperatura CWU | 0x4235 | nastawa CWU pieca (D05 na D+/D-) |
| Zadana temperatura strefy 1 | 0x4201 | nastawa strefy w Immergasie |
| Zadana temperatura strefy 2 | 0x42D6 | jw. (u nas nienadawane) |
| Tryb pracy (4 = grzanie) | 0x4001 | tryb systemu Immergasa (Zima CO+CWU, rejestr 2000 na D+/D-) |
| Tryb CWU | 0x4066 | tryb CWU Immergasa |
| CWU włączona | 0x4065 | żądanie CWU (Dominus / panel / termostat) |
| Strefa 1 / 2 włączona | 0x4000 / 0x411E | żądanie grzania strefy (Salus / panel → Immergas) |
| Bity statusu (0x403 = żądanie) | 0x440E | flaga żądania grzania od Immergasa |
| Regulacja wg temperatury wody | 0x406F | konfiguracja Immergasa |
| Pompa obiegowa | 0x4089 | pompę prowadzi płyta Immergasa (A03/A04, przepływ D14 na T-/T+) |
| **Funkcja nocna:** limit = 19 Hz | 0x8239 (=19) | U11 Immergasa: piec pisze 0x1E W2 = 30 % na D+/D- |
| **Funkcja nocna:** flaga limitu | 0x80B1 | skutek U11 (gdy sprężarka pracuje pod limitem) |
| **Funkcja nocna:** nośnik | 0x428D (=0x011E) | MIM nadaje wartość U11 w swoim cyklu |

## B. Własne jednostki zewnętrznej Samsunga — NIE sterowane przez Immergasa

Immergas wysyła tylko **żądanie** (grzej / nie grzej, zadana), a jednostka zewnętrzna sama decyduje,
jak je zrealizować. Tych rejestrów Immergas nie ustawia.

| Encja | PDU | Kto decyduje |
|---|---|---|
| Częstotliwość sprężarki (rzeczywista / zlecona / docelowa) | 0x8238 / 0x8236 / 0x8237 | ODU dobiera Hz do żądania |
| Limit częstotliwości 64 / 95 (naturalny) | 0x8239 | regulacja ODU w trybie Normal (to NIE U11) |
| Obroty wentylatora (zadane / rzeczywiste) | 0x823D / 0x82D9 | ODU |
| Pozycja EEV (ODU / wewnętrzna) | 0x8229 / 0x4217 | ODU |
| Zawór 4-drogowy / gorącego gazu | 0x801A / 0x8017 | ODU |
| Grzałka tacy ociekowej | 0x80AF | ODU (ochrona przed mrozem) |
| Odszranianie + etap | 0x402E / 0x8061 | ODU decyduje |
| Etap startu / blokada restartu | 0x8248 / 0x8249 | logika ochronna ODU |
| Sprężarka pracuje | 0x8010 | stan ODU |
| Tryb / stan ODU, stan wentylatora | 0x8001 / 0x8003 / 0x800D | status ODU |
| Kod błędu / błąd systemu | 0x8235 | ODU |
| Temperatury ODU: tłoczenie, skraplacz, głowica, IPM, zadane tłoczenie | 0x820A / 0x8218 / 0x8280 / 0x8254 / 0x8223 | telemetria ODU |
| Napięcia, prąd, moc, energia, moc znamionowa | 0x82ED / 0x823B / 0x24FC / 0x8217 / 0x8411 / 0x8413 / 0x8414 / 0x82E3 | telemetria ODU |
| Żądana / znamionowa moc jedn. wewnętrznej | 0x4211 / 0x4212 | ODU / MIM |
| Zawór 2 / 3-drogowy | 0x408A / 0x4067 | aktuator MIM; położenie idzie za żądaniem CWU, ale steruje MIM |
| **94 parametry FSV** | 0x424A… | ustawienia instalatora Samsunga (pilot MIM-E03 / domyślne); nie przez Modbus Immergasa, a krzywa wodna FSV i tak nadpisana przez krzywą Immergasa |
| Firmware ODU / EEPROM / falownik / MIM | 0x0608 / 0x060C / 0x8601 | informacja statyczna |

## C. Współdzielony pomiar (żadna strona nie „steruje”)

| Encja | PDU | Uwaga |
|---|---|---|
| Temperatura zewnętrzna (+ kopia) | 0x8204 / 0x420C | ten sam fizyczny czujnik co D06 / D79 — pomiar, nie sterowanie |
| Temperatura czynnika na wejściu | 0x4205 | = D24 na D+/D- i T-/T+ (odczyt) |
| Temperatura wody wyjściowej TW2 | 0x4204 | odczyt |

## D. Nienadawane u nas / brak danych

Strefa 2 (0x42D4 / 0x42D6), przepływ wody (0x42E9), moc i energia wyprodukowana (0x4426 / 0x4427)
— MIM na zapytanie zwraca 65535. Grzałki elektryczne wspomagająca / zasobnika (0x406C / 0x4087)
— Magis używa kotła gazowego, nie grzałek. Plus kilkanaście surowych PDU bez rozszyfrowania (RAW,
w diagnostyce): 0x0402, 0x0411–0x0415, 0x4006, 0x440A, 0x041B, 0x8201, 0x823F, 0x8243, 0x824B,
0x824C, 0x82E1, 0x840F, 0x8417, 0x4604.

---

**Sedno:** Immergas steruje tym, **co i kiedy** pompa ma robić — nastawami, trybami, żądaniem grzania,
a nawet trybem cichym (U11). Jednostka zewnętrzna sama decyduje, **jak** to zrealizować —
częstotliwością, wentylatorem, zaworem EEV, odszranianiem — i tego Immergas nie dotyka. Dlatego
sterowanie piecem idzie przez D+/D- i T-/T+, a nie przez zapis na F1/F2.
