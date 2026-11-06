"""immergas_ot numbers: a Data-ID value the hub writes (and the gateway override value)."""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import number
from esphome.const import CONF_INITIAL_VALUE, CONF_MAX_VALUE, CONF_MIN_VALUE, CONF_RESTORE_VALUE, CONF_STEP

from .. import CONF_DATA_ID, CONF_IMMERGAS_OT_ID, CONF_VALUE_TYPE, HUB_CHILD_SCHEMA, VALUE_TYPES, immergas_ot_ns

DEPENDENCIES = ["immergas_ot"]
CONF_PERIOD = "period"
OtNumber = immergas_ot_ns.class_("OtNumber", number.Number, cg.Component)

CONFIG_SCHEMA = (
    number.number_schema(OtNumber)
    .extend(
        {
            cv.Required(CONF_DATA_ID): cv.int_range(0, 255),
            cv.Optional(CONF_VALUE_TYPE, default="f88"): cv.one_of(*VALUE_TYPES, lower=True),
            cv.Required(CONF_MIN_VALUE): cv.float_,
            cv.Required(CONF_MAX_VALUE): cv.float_,
            cv.Optional(CONF_STEP, default=0.5): cv.positive_float,
            # how often the hub writes it again (Data-ID 1: 0 = every cycle)
            cv.Optional(CONF_PERIOD, default="10s"): cv.positive_time_period_milliseconds,
            cv.Optional(CONF_INITIAL_VALUE): cv.float_,
            cv.Optional(CONF_RESTORE_VALUE, default=True): cv.boolean,
        }
    )
    .extend(HUB_CHILD_SCHEMA)
    .extend(cv.COMPONENT_SCHEMA)
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_IMMERGAS_OT_ID])
    var = await number.new_number(
        config, min_value=config[CONF_MIN_VALUE], max_value=config[CONF_MAX_VALUE], step=config[CONF_STEP]
    )
    await cg.register_component(var, config)
    cg.add(var.set_hub(hub))
    cg.add(var.set_data_id(config[CONF_DATA_ID]))
    cg.add(var.set_value_type(VALUE_TYPES[config[CONF_VALUE_TYPE]]))
    cg.add(var.set_period(config[CONF_PERIOD].total_milliseconds))
    cg.add(var.set_restore(config[CONF_RESTORE_VALUE]))
    if CONF_INITIAL_VALUE in config:
        cg.add(var.set_initial(config[CONF_INITIAL_VALUE]))
