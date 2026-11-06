[English](ff-control-results.md) · **Polski**

# Wyniki — co most udowodnił na Magisie


Celem projektu było sterowanie **funkcjami jednostki zewnętrznej Samsunga, których Immergas nie udostępnia
przez swój Modbus** (tryb cichy, krzywa grzewcza po stronie ODU, maksymalna temperatura grzania po stronie
ODU), przez wstrzykiwanie ramek zapisu NASA na magistrali F1/F2, **bez ruszania ruchu, którym steruje
Immergas**. Uczciwy wynik, na **Magis Combo 9 Plus V2 + Audax Pro 9 V2**, jest **negatywny, ale wyczerpujący**.
Ten plik go dokumentuje, żeby nikt nie powtarzał ślepych uliczek.

## Ścieżka zapisu działa (dla „miękkich" rejestrów)

Zapis FSV / enum do jednostki wewnętrznej (`20.00.01`) **dociera i utrwala się**. Udowodnione rygorystycznie:
WRITE (`type 0x12`) dostaje odpowiedź MIM (`src 20.00.01`, `type 0x15`) z zapisaną wartością, a niezależny READ
potwierdza nową wartość. Zweryfikowane na:

- **FSV 1012** `0x424B` (min. temp. chłodzenia, inertny) — zapis się utrzymuje.
- **FSV 1031** `0x424E` (maks. temp. zasilania grzania) — zapis się utrzymuje.
- **FR control enable** `0x40A7` — enum `0 → 1` zapisany i odczytany jako `1`.

Parser ufa tylko ramkom od urządzeń (`20.00.01` / `10.00.00`), nigdy własnemu echu (`80.FF.00`), więc te
potwierdzenia są prawdziwe, a nie odbiciem tego, co wysłano.

## …ale każda funkcjonalna dźwignia jest nadpisywana lub odrzucana

| Dźwignia | Rejestr | Wynik |
|---|---|---|
| **Maks.** temp. zasilania grzania (FSV 1031) | `0x424E` | Zapis się utrzymuje, ale **setpoint Immergasa `0x4247` go nadpisuje**: przy żądaniu 31,7 °C przepływ `0x4238` przekroczył maks. 22 °C w stronę żądania. Limity temperatury nic nie dają. |
| **Współczynnik FR** (FSV 5051) | `0x42F1` | Zapis **odrzucony** — zostaje `0xFFFF`. Enable (`0x40A7`) przeskakuje na 1, ale wartość ratio nie wchodzi, a sprężarka `0x8238` się nie zmienia. Zgodne z instrukcją: *„Only tank-integrated hydro units"*. |
| **Tryb cichy** | `0x428D` | Sterowany **funkcją nocną Immergasa U11** (D+/D- → MIM nadaje `0x428D` → ODU zrzuca `0x8239` 64→19). Nie jest to dźwignia tylko-Samsunga; dostępna przez Immergas. |
| **Power peak** (5041) | `0x40A4` | Tylko włączenie; działa dopiero przy zewnętrznym sygnale szczytu (niepodłączony). Zapis trzyma, nic nie robi. |
| **Tryb wyjazdowy** | `0x406D` | Wymaga aktywatora away-mode; brak. Zapis trzyma, nic nie robi. |
| **Smart Grid** (5091) | `0x411C` | Wymaga sygnału SG; niepodłączony. Zapis trzyma, nic nie robi. |

**Wniosek:** na F1/F2 **sterownik Immergasa trzyma pętlę**. Liczy zadaną temperaturę wody z własnej krzywej i
steruje stroną Samsunga przez MIM. Cokolwiek, czego nie kontroluje, albo wymaga zewnętrznego triggera, którego
nie ma, albo jest odrzucane przez jednostkę. Nie ma bezpiecznej *i* skutecznej dźwigni zapisu tylko-Samsunga na
tej instalacji. Tryb cichy, który *da się* uzyskać, to funkcja nocna Immergasa U11.

## OFF-LIMITS — tego nigdy nie zapisuj

Whitelista komponentu dopuszcza tylko FR control (`0x40A7` / `0x42F1`) i jeden skonfigurowany FSV. Celowo
odrzuca wszystko poniżej, i Ty też powinieneś:

- **Częstotliwość sprężarki** `0x8236`–`0x8239`, **pozycja EEV** `0x8229` — zapis steruje sprężarką / zaworem
  rozprężnym wprost. Grozi uszkodzeniem sprzętu.
- **Czujnik przepływu** `0x42E9` (`VAR_IN_FLOW_SENSOR_CALC`) — **karmi ochronę przepływu** (powiązane `0x42E8`,
  `0x4102`, ODU `0x803B`, błędy E911/E912/E913). Fałszywy przepływ mógłby obudzić uśpiony flow-check Samsunga
  (teraz ignoruje sentinel `65535` „brak czujnika") → decyzje ochronne na zmyślonej liczbie → sprężarka na
  sucho → zniszczony wymiennik. Nieodwracalne, zysk kosmetyczny. Immergas nie nadaje `0x42E9`.
- Zawory 4-drogowy / gorącego gazu, defrost, grzałka bazy i każdy inny aktuator / rejestr ochronny ODU.

## Pożyteczna droga zamiast tego: COP, read-only

Konstruktywny cel (znajomość sprawności pompy) lepiej spełnić **bez żadnego zapisu**, licząc COP w Home
Assistant z wartości już obecnych na magistralach:

```
moc_cieplna_W = (przeplyw_l_na_h / 3600) * 4186 * (0x4238 - 0x4236)
COP           = moc_cieplna_W / 0x8413
```

(przepływ z magistrali T-/T+, ΔT i moc elektryczna z czytnika F1/F2.) Dokładniejsze niż wewnętrzny licznik
jednostki zewnętrznej. Czytnik read-only to
[f1f2-nasa](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub).
