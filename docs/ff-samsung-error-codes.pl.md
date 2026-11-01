[English](ff-samsung-error-codes.md) · **Polski**

# Kody błędów Samsung EHS (strona F1/F2 / NASA)

Magis Pro / Combo V2 używa we wnętrzu jednostki zewnętrznej (ODU) układu Samsung EHS, a magistrala
F1/F2 to magistrala NASA tej jednostki. Gdy w części Samsunga wystąpi usterka, kod błędu pojawia się
na dedykowanym przewodowym pilocie Samsung (np. **MWR-WW10N**). Immergas odczytuje tę samą stronę przez
MIM, więc te kody przydają się przy diagnozie magistrali F1/F2.

Poniższe kody przepisano 1:1 z oficjalnej polskiej instrukcji **Samsung EHS** (jednostka wewnętrzna
AE090JNYDEH i pokrewne), sekcja „Wskazówki dotyczące rozwiązywania problemów". To zestaw kodów
widocznych dla użytkownika (czujniki, komunikacja, pompa/przepływ); pełna lista serwisowa jednostki
zewnętrznej jest obszerniejsza.

> Źródło: *Samsung EHS — instrukcja obsługi (SPLIT), PL, EHS Indoor AE090JNYDEH_EU_IB_PL_05130A-00*,
> strony POLSKI-50…52.

## Czujniki temperatury

| Kod | Objaśnienie |
|-----|-------------|
| **E122** | Zwarcie lub przerwa w czujniku temperatury na wlocie EVA |
| **E123** | Zwarcie lub przerwa w czujniku temperatury na wylocie EVA |
| **E653** | Zwarcie lub przerwa w czujniku temperatury pilota przewodowego |
| **E654** | Błąd danych w pilocie zdalnego sterowania (błąd odczytu/zapisu w pamięci) |
| **E901** | Zwarcie lub przerwa w czujniku temperatury na wlocie wody |
| **E902** | Zwarcie lub przerwa w czujniku temperatury na wylocie płytowego wymiennika ciepła |
| **E903** | Zwarcie lub przerwa w czujniku temperatury na wylocie wody (grzałka zapasowa) |
| **E904** | Zwarcie lub przerwa w czujniku temperatury zbiornika wody |
| **E916** | Zwarcie lub przerwa w czujniku temperatury w zaworze mieszania (gdy parametr FSV #4041 ma wartość „1") |

Umiejscowienie czujników (z rysunku instrukcji): **E901** wlot wody, **E902** wylot płytowego wymiennika
ciepła (Tw1/Tw2), **E903** wylot wody / grzałka zapasowa (Tw3), **E904** zbiornik wody, **E122** wlot EVA
(wejście odniesienia), **E123** wylot EVA (wyjście odniesienia), **E653/E654** pilot przewodowy.

## Komunikacja

| Kod | Objaśnienie |
|-----|-------------|
| **E601** | Błąd komunikacji pomiędzy pilotem zdalnego sterowania a jednostką Hydro |
| **E604** | Błąd monitorowania pomiędzy pilotem zdalnego sterowania a jednostką Hydro |
| **E653** | Czujnik temperatury w pilocie zdalnego sterowania odłączony lub uszkodzony |
| **E654** | Błąd danych w pilocie zdalnego sterowania (błąd odczytu/zapisu w pamięci) — problem z przesyłaniem danych pomiędzy modułem Micom i IC07 (EEPROM) |

## Pompa wody i przełącznik przepływu

| Kod | Objaśnienie |
|-----|-------------|
| **E911** | Błąd wyłączenia przełącznika przepływu. Wyzwalany, gdy przełącznik przepływu wyłączy się w ciągu 30 s przy włączonym sygnale pompy wody (uruchamianie), lub w ciągu 15 s po uruchomieniu. Oznacza niewystarczający przepływ wody: < 7 l/min (modele ✴✴090✴✴) / < 12 l/min (modele ✴✴160✴✴). |
| **E912** | Błąd włączenia przełącznika przepływu. Wyzwalany, gdy przełącznik przepływu włączy się w ciągu 10 min przy wyłączonym sygnale pompy wody. Przepływ wody > 7 l/min (✴✴090✴✴) / > 12 l/min (✴✴160✴✴). |

---

Mapowanie FSV (np. #4041) — patrz katalog
`components/f1f2_nasa/f1f2_fsv_catalog.yaml` oraz [ff-fsv-map.pl.md](ff-fsv-map.pl.md).
