# IMMERGAS Modbus BMS NASA OpenTherm HUB

[English](README.md) · **Polski**

[![Release](https://img.shields.io/github/v/release/jotuera/immergas-modbus-bms-nasa-opentherm-hub?label=release&color=0077b6)](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/releases/latest)
[![ESPHome](https://img.shields.io/badge/ESPHome-2026.9%2B-41BDF5?logo=esphome&logoColor=white)](https://esphome.io)
[![Platform](https://img.shields.io/badge/platform-ESP32--S3-41BDF5)](https://docs.m5stack.com/en/core/AtomS3%20Lite)
[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5)](https://hacs.xyz)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-jotuera-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/jotuera)

Jedno urządzenie ESPHome, które mówi językami magistral pomp ciepła i kotłów Immergas – Modbus, BMS, Samsung NASA
i OpenTherm – i przenosi je do Home Assistanta, razem z zestawem kart Lovelace, które robią z nich jeden czytelny
dashboard.

## Obsługiwane protokoły

| Protokół | Urządzenia Immergas | Co robi hub | Status | Strona |
|---|---|---|---|---|
| **Modbus D+/D-** (piec ↔ Dominus / panel strefy) | MAGIS PRO V2, MAGIS COMBO V2 | emuluje panel strefy 1 albo Dominusa: tryb, strefy, nastawy, programy czasowe, błędy | stabilny | [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.pl.md#dd--port-a--piec--dominus--panel-strefy) |
| **Modbus BMS T-/T+** | MAGIS PRO V2, MAGIS COMBO V2 | master Modbus: parametry instalatora, stan systemu, szacowanie gazu, sterowanie źródłem ciepła | stabilny | [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.pl.md#t-t-port-c--modbus-bms) |
| **Samsung NASA F1/F2** (jednostka wewnętrzna ↔ zewnętrzna) | MAGIS PRO V2, MAGIS COMBO V2 (Samsung EHS) | słucha wszystkiego, zapisuje krótką białą listę: sprężarka, obieg chłodniczy, odszranianie, FSV, tryb wyjazdowy | stabilny | [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.pl.md#f1f2-port-b--samsung-nasa-jednostka-wewnętrzna--zewnętrzna) |
| **OpenTherm** | VICTRIX ZEUS, EXA, TERA, OMNIA, HERCULES Condensing … | **master** zamiast CAR V2 / Dominusa albo **bramka** między pilotem a kotłem | eksperymentalny | [Kotły OpenTherm](docs/opentherm-hub.pl.md) |
| **BMS generatora** (Modbus RTU) | kotły gazowe VICTRIX ZEUS Superior 25–35, EXTRA, PRO V2; pompa ciepła MAGIS M TOP | master Modbus: żądanie grzania, nastawy zasilania i CWU, temperatury, błędy | eksperymentalny | [Kotły gazowe po Modbus BMS](docs/gas-boiler-bms.pl.md) |
| **Modbus Midea M-Thermal** (H1 / H2) | MAGIS M (R32) | master Modbus: wł. / wył., tryb, nastawy, krzywe, sprężarka, energia, COP | eksperymentalny | [Pompy ciepła MAGIS M](docs/magis-m-midea.pl.md) |

Każda strona ma sprzęt, schemat podłączenia i bazę wiedzy swojego protokołu. Ponad magistralami hub liczy to, czego
żadna z nich nie pokazuje osobno – COP teraz i dziś, moc cieplną, stan pracy, starty i czas pracy, ostatni cykl CWU
i koszt 1 kWh ciepła z każdego źródła.

**Która strona jest moja?**

- pompa ciepła **MAGIS PRO V2 / COMBO V2** (jednostka zewnętrzna Samsung) → [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.pl.md)
  – jeden hub na wszystkich trzech magistralach, przetestowany i kompletny zestaw;
- **kocioł z CAR V2 / Super Amico albo z Dominusem OpenTherm** → [Kotły OpenTherm](docs/opentherm-hub.pl.md);
- **kocioł gazowy nowej platformy** (ZEUS Superior 25–35, HERCULES 25 / 35, EXTRA) albo **MAGIS M TOP** bez
  Dominusa → [Kotły gazowe po Modbus BMS](docs/gas-boiler-bms.pl.md);
- **MAGIS M** (na Midea, panel przewodowy z H1 / H2) → [Pompy ciepła MAGIS M](docs/magis-m-midea.pl.md);
- tylko **Immergas Dominus** w sieci, bez sprzętu huba → [integracja Immergas Dominus](https://github.com/jotuera/immergas-dominus)
  korzysta z tych samych kart.

> Zbudowany i przetestowany na Immergas **Magis Combo 9 Plus V2** z jednostką zewnętrzną **Audax Pro 9 V2**. Części
> OpenTherm, BMS generatora i Midea idą za oficjalnymi specyfikacjami i ustaleniami społeczności i czekają na pierwsze
> instalacje – zgłoszenia są mile widziane ([Zbieranie logów](docs/collecting-logs.pl.md)).

## Dashboard

Karty same znajdują hub i wszystkie jego encje: bez identyfikatorów encji i bez YAML. Cały dashboard to jedna linijka:

```yaml
strategy:
  type: custom:immergas-hub
```

![Schemat instalacji](docs/images/card-diagram.png)

| | |
|---|---|
| ![Teraz](docs/images/card-now.png) | ![Tryb pracy](docs/images/card-mode.png) |
| **Teraz** — stan, COP teraz / dziś, liczniki cykli z typową długością, ostatnie 6 h, sprężarka i palnik dziś | **Tryb pracy** — tryby (dotknij 2×), źródło ciepła CO i CWU, funkcja nocna, anty-legionella, tryb wyjazdowy, ograniczenie sprężarki, programy czasowe CO i CWU, przełączniki |
| ![Krzywa grzewcza](docs/images/card-curve.png) | ![Harmonogram](docs/images/card-schedule.png) |
| **Krzywa grzewcza** — punkty do przeciągania, krzywe chłodzenia i trybu wyjazdowego | **Harmonogram** — 4 kalendarze pieca dla CO i CWU, jak w aplikacji Dominus |
| ![Nastawy](docs/images/card-setpoints.png) | ![Koszt ciepła](docs/images/card-heat-cost.png) |
| **Nastawy** — strefa 1 i ciepła woda z Eko / Komfort | **Pompa, gaz czy grzałka?** — koszt 1 kWh ciepła z każdego źródła |

![Wykresy](docs/images/card-charts.png)

**Łączność** – wszystkie magistrale i urządzenia, z którymi rozmawia hub, w jednym miejscu: zielony = połączono, niebieski = emulowane przez hub.

![Łączność](docs/images/card-links.png)

**Kalibracja** – instalator pomp ciepła zamknięty w karcie: każdy parametr, który hub widzi, wartość modelowa, twoja
wartość i rekomendacja z ostatnich 24 h ([więcej](docs/magis-pro-combo-v2.pl.md#kalibracja)).

![Kalibracja](docs/images/card-calibration.png)

Pozostałe karty: obieg wodny i chłodniczy, stan urządzeń, ostatni cykl CWU, automatyzacje, mapa magistral i ustawienia
huba. Szczegóły, opcje i instalacja (HACS albo ręczna): [cards/README.pl.md](cards/README.pl.md). Napisy są w języku
Home Assistanta: polski, angielski, czeski, niemiecki, hiszpański, francuski, węgierski, włoski, niderlandzki,
portugalski, słowacki.

## Dokumentacja

| | |
|---|---|
| [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.pl.md) | D+/D-, T-/T+, F1/F2: sprzęt, podłączenie, instalacja, pierwsze uruchomienie, kalibracja, gaz, mapy rejestrów |
| [Kotły OpenTherm](docs/opentherm-hub.pl.md) | master i bramka, adaptery, zaciski kotłów według rodzin |
| [Kotły gazowe po Modbus BMS](docs/gas-boiler-bms.pl.md) | SUPERIOR / EXTRA / PRO V2, MAGIS M TOP, mapa rejestrów |
| [Pompy ciepła MAGIS M](docs/magis-m-midea.pl.md) | Midea M-Thermal na H1 / H2, mapa rejestrów |
| [Kopalnia wiedzy](docs/knowledge-base.pl.md) | jak działają magistrale, wiedza o instalacji, rozwiązywanie problemów |
| [Zbieranie logów](docs/collecting-logs.pl.md) | inny model albo nieznany sygnał – co nagrać do zgłoszenia |
| [Karty](cards/README.pl.md) | karty Lovelace, opcje, instalacja |

> ⚠️ Magistrale są wewnątrz urządzeń i łączą się z elektroniką zasilaną z sieci. Przed otwarciem czegokolwiek odłącz
> zasilanie, a podłączenie zostaw komuś z uprawnieniami. Podłączenie obcego sprzętu może mieć wpływ na gwarancję –
> najpierw zapytaj instalatora. To niezależny projekt: nie jest tworzony, zatwierdzany ani wspierany przez Immergas,
> Samsung ani Midea. Używasz go na własną odpowiedzialność.

## Wsparcie

Jeśli hub ci się przydaje, rozważ wsparcie – postaw mi kawę. Dziękuję!

<a href="https://buymeacoffee.com/jotuera"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me a Coffee" width="260"></a>

## Licencja

[PolyForm Noncommercial 1.0.0](LICENSE): bezpłatnie do użytku osobistego i innego niekomercyjnego – w domu, we
własnej instalacji, do nauki i badań. **Użycie komercyjne** (instalatorzy montujący hub klientom, sprzedaż urządzeń z tym
firmware, wbudowanie w płatny produkt) wymaga osobnej licencji – skontaktuj się przez GitHub. Zobacz też
[NOTICE](NOTICE) i [CONTRIBUTING](CONTRIBUTING.md). Immergas, Samsung i Midea są znakami towarowymi ich właścicieli.
