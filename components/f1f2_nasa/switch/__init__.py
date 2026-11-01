import esphome.codegen as cg
from esphome.components import switch
import esphome.config_validation as cv

from .. import CONF_F1F2_NASA_ID, CONF_TYPE, DOMAIN, HUB_ID_SCHEMA, auto_name, f1f2_nasa_ns, tr

DEPENDENCIES = [DOMAIN]

NasaSnifferSwitch = f1f2_nasa_ns.class_("NasaSnifferSwitch", switch.Switch)


def _fill(config):
    config = dict(config)
    config.setdefault("name", auto_name(tr()["switches"]["sniffer"]))
    config.setdefault("entity_category", "diagnostic")
    config.setdefault("icon", "mdi:magnify-scan")
    return config


CONFIG_SCHEMA = cv.All(
    _fill,
    switch.switch_schema(NasaSnifferSwitch, default_restore_mode="RESTORE_DEFAULT_OFF")
    .extend(HUB_ID_SCHEMA)
    .extend({cv.Optional(CONF_TYPE, default="sniffer"): cv.one_of("sniffer", lower=True)}),
)


async def to_code(config):
    var = await switch.new_switch(config)
    await cg.register_parented(var, config[CONF_F1F2_NASA_ID])
