"""immergas_ot switches: the master flags of Data-ID 0 and the gateway overrides."""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import switch
from esphome.const import CONF_TYPE

from .. import CONF_DATA_ID, CONF_IMMERGAS_OT_ID, HUB_CHILD_SCHEMA, immergas_ot_ns

DEPENDENCIES = ["immergas_ot"]
OtSwitch = immergas_ot_ns.class_("OtSwitch", switch.Switch, cg.Component)
KINDS = {"ch_enable": 0, "dhw_enable": 1, "cooling_enable": 2, "otc_enable": 3, "ch2_enable": 4, "override": 5}


def _override_needs_id(config):
    if config[CONF_TYPE] == "override" and CONF_DATA_ID not in config:
        raise cv.Invalid("type: override needs data_id (0 = the master flags)")
    return config


CONFIG_SCHEMA = cv.All(
    switch.switch_schema(OtSwitch)
    .extend(
        {
            cv.Required(CONF_TYPE): cv.one_of(*KINDS, lower=True),
            cv.Optional(CONF_DATA_ID): cv.int_range(0, 255),
        }
    )
    .extend(HUB_CHILD_SCHEMA)
    .extend(cv.COMPONENT_SCHEMA),
    _override_needs_id,
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_IMMERGAS_OT_ID])
    var = await switch.new_switch(config)
    await cg.register_component(var, config)
    cg.add(var.set_hub(hub))
    cg.add(var.set_kind(KINDS[config[CONF_TYPE]]))
    cg.add(var.set_data_id(config.get(CONF_DATA_ID, 0)))
