# Dashboard huba

[English](README.md) · **Polski**

**Zalecane:** karty huba same budują cały pulpit. Utwórz pusty pulpit, otwórz edytor surowej konfiguracji i wpisz:

```yaml
strategy:
  type: custom:immergas-hub
```

Potrzebne są tylko encje huba i karty ([cards/README.pl.md](../cards/README.pl.md)). Generator opisany niżej to
wariant bez kart własnych: wyłącznie wbudowane karty Home Assistant.

`immergas-hub-dashboard.jinja` to generator gotowego pulpitu (5 widoków: Przegląd, CWU, Koszty, Ustawienia,
Diagnostyka). Używa tylko wbudowanych kart Home Assistant, więc nie wymaga nic z HACS.

## Dlaczego generator, a nie gotowy YAML

`entity_id` w HA zależy od nazwy urządzenia, obszaru i ustawienia formatu identyfikatorów
(Ustawienia → System). Ta sama encja może mieć `sensor.immergas_dft_hub_immergas_hub_cop` albo
`sensor.kotlownia_immergas_dft_hub_immergas_hub_cop`, a nawet obie wersje w jednym urządzeniu (encje dodane
po przypisaniu obszaru dostają jego nazwę na początku). Generator szuka encji po **nazwie**
(„Immergas Hub - COP”) w urządzeniu, które ma encję „Immergas Hub - Stan pracy” (albo „Operating state”), i wstawia
prawdziwe `entity_id` z Twojego HA.

## Jak użyć

1. Narzędzia deweloperskie → **Szablon** → usuń przykładowy tekst i wklej cały plik `immergas-hub-dashboard.jinja`.
2. Skopiuj wynik z prawej strony (pierwsza linia: `# Generated for device ...`).
3. Ustawienia → Pulpity → **Dodaj pulpit** → „Nowy pulpit od zera” → otwórz go.
4. Ołówek (edycja) → trzy kropki → **Edytor konfiguracji (surowy)** → zastąp całość skopiowanym wynikiem → Zapisz.

Po aktualizacji huba wystarczy powtórzyć kroki 1-4 (pulpit jest generowany od nowa).

## Gdy czegoś brakuje

- Encja wyświetlana jako `sensor.missing_...` = nie znaleziono encji o tej nazwie. Zwykle została ręcznie
  przemianowana w HA (zmieniona nazwa, nie `entity_id`) albo jest wyłączona. Przywróć nazwę domyślną albo popraw
  wiersz ręcznie w pulpicie.
- Generator działa z polskimi i angielskimi nazwami encji (`lang/*_pl` / `lang/*_en`) i domyślnymi prefiksami
  (`Immergas DD/TT/FF/Hub - ...`). Tytuły i etykiety są w języku huba.
