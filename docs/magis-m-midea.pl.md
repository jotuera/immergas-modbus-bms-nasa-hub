# Pompy ciepła MAGIS M (Midea M-Thermal) – pakiety mt_

[English](magis-m-midea.md) · **Polski**

Powrót do [przeglądu protokołów](../README.pl.md).

> **Eksperymentalne – jeszcze nie testowane na MAGIS M.** Pakiety implementują protokół Modbus Midea M-Thermal, na
> którym zbudowany jest MAGIS M. Masz taką pompę – zgłoś, co widzisz (patrz [Zbieranie logów](collecting-logs.pl.md)).

Immergas **MAGIS M** (M4 – M30, R32) to pompa Midea M-Thermal: panel przewodowy z portem Modbus H1 / H2, w menu nazwy
T1S / T4 / T5 / IBH / TBH. Nie ma nic wspólnego z MAGIS PRO / COMBO V2 na Samsungu, które obsługuje reszta huba.
**MAGIS M TOP** (R290, E-BOX TOP) to jeszcze co innego: jego port BMS mówi protokołem BMS generatora Immergasa – patrz
[Kotły gazowe po Modbus BMS](gas-boiler-bms.pl.md) (pakiet `gb_mtop`).

## Sprzęt

| Element | |
|---|---|
| [M5Stack AtomS3 Lite](https://docs.m5stack.com/en/core/AtomS3%20Lite) + ATOMIC PortABC | ESP32-S3; port C (RX GPIO6, TX GPIO5) |
| 1× M5Stack Isolated RS485 Unit | izolacja galwaniczna, automatyczny kierunek (bez pinu DE) |

Działa każdy ESP32 z transceiverem RS485 (`mt_uart_rx_pin` / `mt_uart_tx_pin`).

## Podłączenie

| Hub (RS485) | Panel przewodowy | Uwagi |
|---|---|---|
| A / B | **H1 / H2** | źródła różnią się, który to A+ – brak odpowiedzi: zamień; może być potrzebny rezystor 120 Ω między H1 i H2 |
| GND | **E** | odniesienie |
| – | ~~A / B~~ | **nigdy**: zasilanie panelu 13,5 V AC |
| – | ~~X / Y~~ | **nigdy**: wewnętrzna magistrala panel ↔ moduł hydrauliczny |

Hub jest masterem, panel slave'em: **9600 bodów, 8N1, adres 1** (menu panelu *FOR SERVICEMAN → 17 HMI ADDRESS*).
Na H1 / H2 tylko jeden master, a panel musi zostać podłączony – to on podaje rejestry.

## Instalacja

> 📄 **Plik konfiguracji: [`examples/immergas-magis-m.yaml`](../examples/immergas-magis-m.yaml)**
> ([otwórz na GitHubie](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/blob/main/examples/immergas-magis-m.yaml) · [pobierz (raw)](https://raw.githubusercontent.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/main/examples/immergas-magis-m.yaml))

1. **Skopiuj konfigurację.** Zapisz [`immergas-magis-m.yaml`](../examples/immergas-magis-m.yaml) w folderze ESPHome (w Home Assistant: *ESPHome →
   Nowe urządzenie → Kontynuuj → Pomiń*, a potem wklej treść do nowego pliku).
2. **Dodaj sekrety**, których używa, do `secrets.yaml`: `wifi_ssid`, `wifi_password`, `immergas_magis_m_api_key`, `immergas_magis_m_ota_password`.
3. **Wybierz, czego potrzebujesz** w bloku `packages:` na końcu pliku:

   ```yaml
   files:
     - packages/lang/mt_en.yaml        # albo mt_pl.yaml
     - packages/mt_core.yaml
     - packages/mt_status.yaml
     - packages/mt_sensors.yaml
     - packages/mt_energy.yaml
     - packages/mt_control.yaml
     - packages/mt_params.yaml         # opcjonalnie: parametry instalatora, tylko odczyt
   ```

   - Zacznij od wszystkich pakietów; na pierwsze uruchomienie tylko z odczytem pomiń `mt_control`.
   - `mt_energy_multiply` (podstawienie), jeśli liczniki energii wychodzą 100× za małe.
4. **Sprawdź piny** (`substitutions:` na górze), jeśli twoja płytka to nie AtomS3 + ATOMIC PortABC.
5. **Wgraj** urządzenie (pierwszy raz przez USB, potem przez sieć) i **dodaj je w Home Assistant** (*Ustawienia →
   Urządzenia i usługi* – znajdzie się samo).
6. **Sprawdź połączenie:** *Immergas M - Wersja protokołu* i *Temperatura wody na wylocie* dostają wartości w ciągu minuty. Nic = zamień H1 / H2, sprawdź rezystor 120 Ω i adres panelu (menu 17).

**Przed jakąkolwiek zmianą poczekaj na pierwsze odczyty** – przełączniki wł. / wył. i funkcji zmieniają pojedyncze
bity wspólnych rejestrów i korzystają z ostatniej odczytanej wartości.

## Pakiety

| Pakiet | Co daje |
|---|---|
| `mt_core` | UART / Modbus, przełącznik *Połączenie Modbus*, wersja protokołu (187), flaga rozdzielczości czujników (189 bit8: 1 °C albo 0,1 °C), pomocnik zapisu |
| `mt_status` | bieżący tryb, bieżący i trzy ostatnie błędy, odszranianie / ochrona przed zamarzaniem / powrót oleju / termostat / SG / EVU, grzałki IBH1 / IBH2 / TBH, pompy, zawór 3-drogowy, alarm, praca, wersje oprogramowania |
| `mt_sensors` | częstotliwość i docelowa częstotliwość sprężarki, wentylator, zawór rozprężny, woda wlot / wylot / całkowita, temp. zewnętrzna, pokoju, zasobnika CWU, temperatury czynnika, ciśnienia, prąd i napięcie jednostki zewn., bufor, godziny sprężarki, zasilanie z krzywej, przepływ wody, moc cieplna |
| `mt_energy` | liczniki energii elektrycznej i cieplnej, moc grzewcza i pobór, COP jednostki i własny COP huba |
| `mt_control` | wł. / wył. strefa 1 / strefa 2 / CWU / wg pokoju, tryb pracy (auto / chłodzenie / grzanie), nastawy wody strefy 1 / 2, nastawa pokoju i CWU, krzywa pogodowa wł. / numer, tryb cichy, ECO, dezynfekcja, wymuszona CWU / grzałka zasobnika / grzałka IBH |
| `mt_params` (opcjonalny) | tylko odczyt: limity nastaw, limity temp. zewn. dla grzania, krzywa własna |
| `lang/mt_en`, `lang/mt_pl` | nazwy encji (`mt_name_prefix`, domyślnie „Immergas M”) |

Plik konfiguracji i kroki są w sekcji [Instalacja](#instalacja).

## Mapa rejestrów (holding, funkcja 0x03 / 0x06)

| Rejestr | Znaczenie | Uwagi |
|---|---|---|
| 0 | wł. / wył.: bit0 wg pokoju, bit1 strefa 1, bit2 CWU, bit3 strefa 2 | pole bitowe – hub zmienia tylko swój bit |
| 1 | tryb: 1 auto, 2 chłodzenie, 3 grzanie | |
| 2 | nastawa wody: młodszy bajt strefa 1, starszy strefa 2 | °C albo °C × 2 przy rozdzielczości 0,1 °C |
| 3 | nastawa pokoju | °C × 2 |
| 4 | nastawa CWU | °C |
| 5 | funkcje: bit4 dezynfekcja, bit6 tryb cichy, bit10 ECO, bit12 / bit13 krzywa strefa 1 / 2 | pole bitowe |
| 6 | numer krzywej: młodszy bajt strefa 1, starszy strefa 2 | 1–9 (9 = własna) |
| 7 / 8 / 9 | wymuszona CWU / grzałka zasobnika TBH / grzałka IBH | 0 wg programu, 1 wł., 2 wył. |
| 100 / 132 | częstotliwość / docelowa częstotliwość sprężarki | Hz |
| 101 / 199 | bieżący tryb | 199: 0 wył., 2 chłodzenie, 3 grzanie, 5 CWU |
| 102 / 103 | obroty wentylatora / zawór rozprężny | rpm / kroki |
| 104 / 105 / 110 / 111 | woda wlot / wylot / całkowita / strefa 2 | flaga rozdzielczości |
| 106 / 108 / 109 / 112 / 113 | T3 wymiennik, tłoczenie, ssanie, T2 ciecz, T2B gaz | flaga rozdzielczości |
| 107 / 114 / 115 | zewnętrzna (T4) / pokój / zasobnik CWU (T5) | flaga rozdzielczości |
| 116 / 117 | ciśnienie wysokie / niskie | kPa (starszy protokół × 10) |
| 118 / 119 | prąd / napięcie jednostki zewnętrznej | A / V |
| 120 / 121 | bufor góra / dół | |
| 122 / 123 | godziny sprężarki / moc jednostki | h / kW |
| 124–127 | bieżący błąd, trzy ostatnie | kod |
| 128 | bity stanu: 1 odszranianie, 2 ochrona przed zamarzaniem, 3 powrót oleju, 4 zdalne, 6 / 7 termostat grzanie / chłodzenie, 10 SG, 11 EVU | |
| 129 | wyjścia: 0 IBH1, 1 IBH2, 2 TBH, 3 pompa wewn., 4 SV1, 6 pompa zewn., 12 alarm, 13 praca | |
| 130 / 131 | oprogramowanie jednostki wewn. / panelu | |
| 135 | temperatura modułu inwertera | °C |
| 136 / 137 | zasilanie z krzywej strefa 1 / 2 | |
| 138 | przepływ wody | 0,01 m³/h (pokazywany w l/min) |
| 140 | moc cieplna | 0,01 kW |
| 143–144 / 145–146 | energia elektryczna / cieplna (słowo starsze, młodsze) | domyślnie 0,01 kWh (`mt_energy_multiply`) |
| 148 / 150 / 151 | moc grzewcza / pobór / COP | 0,01 (protokół V4.6+) |
| 187 / 189 | wersja protokołu / status 2 (bit8 = rozdzielczość 0,1 °C) | |
| 201–208 | limity nastaw (chłodzenie, grzanie, CWU) | czytane pojedynczo |
| 231 / 232 | grzanie – maks. / min. temp. zewn. | |
| 265–268 | krzywa własna: zasilanie zimny / ciepły punkt, temp. zewn. zimny / ciepły punkt | |

**Do potwierdzenia na MAGIS M:** polaryzacja H1 / H2, jednostka liczników energii, skala ciśnień w danej wersji
protokołu, czy nastawy rejestru 2 idą za flagą rozdzielczości i numeracja kodów błędów (pokazywana jako liczba).
Parametrów instalatora od 209 w górę celowo się nie zapisuje.

## Baza wiedzy

- Protokół Modbus Midea M-Thermal panelu przewodowego (rodzina KJR-120) – mapa rejestrów powyżej; wersja protokołu
  (187) i flaga rozdzielczości (189) mówią, który wariant ma dana jednostka.
- Instrukcja instalatora MAGIS M ST006126a: zaciski panelu A B X Y E i H1 / H2 / E, menu *FOR SERVICEMAN → 17 HMI
  ADDRESS SET*, parametry T1S / T4 / T5 / IBH / TBH.
- Projekty społeczności dla klonów Midea M-Thermal (tylko jako odniesienie dla adresów i skal):
  [Mosibi/Midea-heat-pump-ESPHome](https://github.com/Mosibi/Midea-heat-pump-ESPHome), wątki na forum Home Assistant
  o klonach Midea od Immergasa.
