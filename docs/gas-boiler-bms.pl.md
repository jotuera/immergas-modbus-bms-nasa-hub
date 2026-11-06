# Kotły gazowe po Modbus BMS (pakiety gb_)

[English](gas-boiler-bms.md) · **Polski**

> **Eksperymentalne – jeszcze nie testowane na prawdziwym kotle.** Pakiety idą za oficjalnymi specyfikacjami VIPS gas
> (*Specifikace protokolu Modbus*, wersja 02/2025) dla VICTRIX SUPERIOR 2021, VICTRIX EXTRA i VICTRIX PRO V2 EU.
> Masz taki kocioł – zgłoś, co widzisz (patrz [Zbieranie logów](collecting-logs.pl.md)).

W trybie BMS kocioł jest **slave'em** Modbus RTU, a hub **masterem**. Kocioł jest wtedy tylko źródłem ciepła: grzeje
do temperatury zasilania podanej przez mastera, dopóki master podtrzymuje żądanie grzania. Krzywa pogodowa, termostat
pokojowy, strefy i harmonogramy to zadanie Home Assistanta (albo opcjonalnego pakietu `gb_curve`).

**BMS i Dominus się wykluczają.** Menu kotła *Modbus / Typ* to Dominus **albo** BMS, na tych samych zaciskach D+ / D−.
Przy BMS nie podłączaj Dominusa, CAR V2 / pilota Immergas, termostatu pokojowego, bezprzewodowej centrali stref ani
modułów DIM – kocioł zgłosi konflikt mastera albo je pominie.

## Kotły

| Kocioł | Pakiet | Magistrala | Menu kotła |
|---|---|---|---|
| VICTRIX SUPERIOR 2021, VICTRIX ZEUS Superior 25 / 30 / 35 | `gb_superior` | D+ / D−, zworka X40 zostaje | MENU / Serwis / Modbus, Typ = Bms (kod 1122); FW płyty kotła 1.05+, wyświetlacza 1.31+ |
| VICTRIX EXTRA (28 / 32, 12 / 24 / 35 PLUS) | `gb_extra` | D+ / D−, X40 zostaje | P.18 = 2 (BMS), P.11 = 1 (kod 69) |
| VICTRIX PRO V2 EU (także prosta kaskada) | `gb_pro` | **T+ / T−** listwy A38, X40 zdjęta | nic nie trzeba włączać (kod 123 tylko dla parametrów portu) |

Port fabrycznie: **9600 bodów, 8E1, adres slave 1** we wszystkich trzech. PRO V2 EU: terminacja 120 Ω mostkiem TRD – T−,
a gdy master nie ma rezystorów podciągających – mostki TR+ – T+ i TR− – T−.

## Pakiety

| Pakiet | Co daje |
|---|---|
| `gb_core` | UART / Modbus, przełącznik *Połączenie BMS*, przełącznik **Żądanie grzania (CO)** – gdy włączony, hub co 10 s wpisuje 0x0055 do rejestru 512 (żądanie wygasa po 30 s) |
| `gb_control` | *Tryb pracy* (Stand-by / Tylko CWU / Ogrzewanie / Ogrzewanie + CWU), *Nastawa zasilania CO* (514), *Nastawa CWU* (515), *Reset usterki* (257 = 0xAA55) |
| `gb_status` | bity stanu (płomień, pompa CO / CWU, CO / CWU / ochrona przed zamarzaniem dozwolone, funkcja specjalna, usterka kasowalna / niekasowalna), kod i opis usterki, limity CO / CWU kotła, konfiguracja portu |
| `gb_sensors` | zasilanie, powrót, CWU, temp. zewnętrzna, modulacja, obliczone zasilanie, temperatura za sprzęgłem (HVDT) |
| `gb_superior` / `gb_extra` / `gb_pro` | dodatki modelu z tabeli niżej – wczytaj dokładnie jeden |
| `gb_curve` (opcjonalny) | krzywa pogodowa w hubie: co minutę nastawa zasilania CO z sondy zewnętrznej kotła, między dwoma punktami, w granicach limitów kotła |
| `lang/gb_en`, `lang/gb_pl` | nazwy encji (`gb_name_prefix`, domyślnie „Immergas Gas”) |

Przykład [`examples/immergas-gas-bms.yaml`](../examples/immergas-gas-bms.yaml): jeden AtomS3 + ATOMIC PortABC + jeden
Isolated RS485 Unit na porcie C.

## Mapa rejestrów

Rejestry tylko do odczytu odpowiadają wyłącznie na funkcję 0x04 (input), zapisywalne na 0x03 / 0x06 / 0x10 (holding).
Temperatury i procenty w jednostkach 0,1, chyba że zaznaczono inaczej.

| Rejestr | Typ | Znaczenie | SUP | EXT | PRO |
|---|---|---|---|---|---|
| 0 | input | stan: bit0 funkcja specjalna, bit1 CWU dozwolona, bit2 CO dozwolone, bit3 ochrona przed zamarzaniem dozwolona, bit4 palnik, bit5 pompa / zawór CO, bit6 pompa / zawór CWU, bit9 BOOST wyłączony (SUP / EXT) albo ECO włączone (PRO), bit12 usterka kasowalna, bit13 usterka niekasowalna | ✓ | ✓ | ✓ |
| 1 | input | kod usterki | ✓ | ✓ | ✓ |
| 256 | holding | sterowanie: bit1 zezwól CWU, bit2 zezwól CO (SUP: ustawia też bit1), bit9 BOOST wył. (SUP / EXT) / ECO wł. (PRO) | ✓ | ✓ | ✓ |
| 257 | holding | 0xAA55 = reset usterki | ✓ | ✓ | ✓ |
| 512 | holding | żądanie grzania 0x0055 (PRO także 0x0155 = bez priorytetu CWU), wygasa po 30 s | ✓ | ✓ | ✓ |
| 513 | holding | górny limit mocy (0,1 %) | – | – | ✓ |
| 514 / 515 | holding | nastawa zasilania CO / CWU | ✓ | ✓ | ✓ |
| 768 / 769 / 770 | input | temperatura zasilania / powrotu / CWU | ✓ | ✓ | ✓ |
| 771 | input | temperatura spalin | pełne °C | 0,1 °C | 0,1 °C |
| 772 | input | temperatura zewnętrzna (z sondą) | ✓ | ✓ | ✓ |
| 773 | input | ciśnienie w instalacji (0,1 bar) | – | ✓ | ✓ |
| 774 | input | prąd jonizacji (0,1 µA) | – | – | ✓ |
| 775 / 776 / 777 | input | modulacja / obliczone zasilanie / za HVDT | ✓ | ✓ | ✓ |
| 778 | input | temperatura wody zimnej CWU | ✓ | ✓ | – |
| 779 / 780 | input | przepływ CWU / pompy (l/min) | ✓ / ✓ | – / ✓ | – |
| 781 | input | obroty wentylatora (rpm) | ✓ | ✓ | – |
| 837–840 | input | godziny palnika CWU / CO (słowo starsze, młodsze) | – | ✓ | – |
| 841–842 | input | godziny palnika (słowo starsze, młodsze) | ✓ | – | – |
| 1024–1027 | input | maks. / min. CO, maks. / min. CWU | ✓ | ✓ | ✓ |
| 61440–61442 | holding | adres slave, parzystość / stop / prędkość, 0xCC33 = zastosuj | ✓ | ✓ | ✓ |

**Watchdog.** Ponad 30 s bez ramki od mastera: **E144** „BMS offline” (SUP, EXT) albo błąd **100** (PRO); kasuje się
sam przy pierwszej poprawnej ramce. Szybkie odpytywanie co 10 s.

**Do potwierdzenia na kotle:** przesunięcie adresów (tabele podają adresy surowe), czy temp. zewnętrzna ma znak i co
pokazuje „brak sondy”, rozdzielczość przepływów, wzór godzin (PDF podaje 65535 × starsze), a w EXTRA / PRO – czy sam
bit2 zezwala też na CWU. Żadna specyfikacja nie podaje kodów usterek poza 144 / 100.
