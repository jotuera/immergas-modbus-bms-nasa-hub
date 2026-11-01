import esphome.codegen as cg
from esphome.components import button
import esphome.config_validation as cv

from .. import CONF_F1F2_NASA_ID, CONF_TYPE, DOMAIN, HUB_ID_SCHEMA, auto_name, f1f2_nasa_ns, tr

DEPENDENCIES = [DOMAIN]

NasaPollButton = f1f2_nasa_ns.class_("NasaPollButton", button.Button)


def _fill(config):
    config = dict(config)
    config.setdefault("name", auto_name(tr()["buttons"]["poll"]))
    config.setdefault("entity_category", "config")
    config.setdefault("icon", "mdi:download")
    return config


CONFIG_SCHEMA = cv.All(
    _fill,
    button.button_schema(NasaPollButton)
    .extend(HUB_ID_SCHEMA)
    .extend({cv.Optional(CONF_TYPE, default="poll"): cv.one_of("poll", lower=True)}),
)


async def to_code(config):
    var = await button.new_button(config)
    await cg.register_parented(var, config[CONF_F1F2_NASA_ID])
