# Zbieranie logów

[English](collecting-logs.md) · **Polski** · powrót do [README](../README.pl.md)

Hub powstał na jednej instalacji (Magis Combo 9 Plus V2 + Audax Pro 9 V2). Inne modele, więcej stref i akcesoria
(osuszacz, wejście fotowoltaiki, zestaw solarny…) używają rejestrów, których jeszcze nikt nie rozszyfrował. Dobre logi
z twojej instalacji to sposób, żeby hub je poznał. Ta strona pokazuje, co zebrać i jak.

## 1. Opisz instalację

- Modele jednostki wewnętrznej i zewnętrznej (tabliczki znamionowe), liczba stref, jakie akcesoria są podłączone.
- Z Home Assistanta: *Immergas Hub - Wersja projektu*, *Immergas TT - D61 Model systemu*,
  *Immergas TT - A11 Model jednostki zewnętrznej*, *Immergas DD - D91 Wersja oprogramowania kotła*,
  *Immergas DD - PC D132-D135 Firmware falownika ODU*.
- Zrzut ekranu karty **Łączność**.

## 2. Włącz szczegółowe logi

W YAML-u huba podnieś poziom logów dla znaczników magistral, wgraj i otwórz logi (ESPHome → *Logs* albo
`esphome logs immergas-hub.yaml`):

```yaml
logger:
  level: DEBUG
  logs:
    sniff: DEBUG          # zmiany rejestrów na D+/D-
    f1f2_sniff: DEBUG     # zmiany wartości na F1/F2 (NASA)
    modbus_controller: INFO
    sensor: WARN          # ukrywa rutynowe linie „nowa wartość”
```

Po wszystkim wróć do `level: INFO` – logi DEBUG są bardzo długie.

## 3. Włącz nasłuch

| Magistrala | Jak | Co trafia do logu |
|---|---|---|
| **D+/D-** | przełącznik *Immergas DD - Sniffer magistrali*; *Sniffer reset mapy* zaczyna od nowa | linie `NEW` / `CHG` dla każdego rejestru, który się pojawia albo zmienia, z adresem urządzenia (0x1E pompa ciepła, 0x29 panel strefy, 0x33 Dominus…) |
| **F1/F2** | przełączniki *Sniffer NASA* i *Discovery (log zmian z kontekstem)* | każda zmieniająca się wartość NASA z migawką kluczowych wartości obok |
| **T-/T+** | tej magistrali nie da się podsłuchać – hub jest na niej masterem. Dodaj `packages/tt_scanner.yaml`, włącz *Skaner PDU - tryb skanera* (zwykłe odpytywanie się wstrzymuje), ustaw *Skaner PDU - od / do* i naciśnij *Skanuj zakres (od-do)* | `OK PDU <n> = <wartość>` dla każdego rejestru, który odpowiada |

Skaner tylko **czyta**. Zeskanuj ten sam zakres przed zmianą i po niej, a potem porównaj obie listy.

## 4. Nagrywaj jedną zmianę naraz

1. Zostaw instalację w spokoju na **10 minut** – to punkt odniesienia.
2. Zrób **jedną** rzecz i **zapisz dokładną godzinę**: włącz akcesorium, zmień jedno ustawienie na piecu albo panelu,
   uruchom CWU, zewrzyj styk PV…
3. Odczekaj **5 minut**, potem cofnij zmianę i odczekaj kolejne 5.
4. Powtórz 2–3 razy – rejestr, który za każdym razem idzie za twoją zmianą, jest tym, którego szukamy.

## 5. Wyślij

Otwórz zgłoszenie z szablonu **New model or unknown signal**, dołącz log jako plik (nie wklejaj go) i wypisz swoje
działania z godzinami. W logach nie ma haseł; sprawdź jednak, czy nie ma w nich nazwy sieci Wi-Fi albo adresu, których
nie chcesz pokazywać.
