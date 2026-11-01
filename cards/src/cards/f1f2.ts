// "Sterowanie F1/F2 / F1/F2 control": outing mode and FR compressor limit (two-tap confirm). The same controls are
// also shown in the Operating mode card (under the night mode); this card is kept for dashboards that use it alone.
import { HubCard, html, register } from "../base";

class ImmergasF1F2Card extends HubCard {
  protected body() {
    return html`${this.head("mdi:tune-vertical", this.t("Sterowanie F1/F2", "F1/F2 control"), this.t("dotknij 2× aby przełączyć", "tap twice to switch"))}${this.f1f2Rows()}`;
  }
}

register("immergas-f1f2-card", ImmergasF1F2Card, "Immergas – Sterowanie F1/F2 / F1/F2 control",
  "Tryb wyjazdowy i ograniczenie sprężarki FR na jednostce zewnętrznej (2× dotknięcie); te same przełączniki są w karcie Tryb pracy");
