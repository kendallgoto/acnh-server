#!/usr/bin/env python3

import argparse
import asyncio
from aiohttp import web
import logging
import os
import time
import math
from contextlib import contextmanager

from aioconsole import ainput

from joycontrol import logging_default as log, utils
from joycontrol.command_line_interface import ControllerCLI
from joycontrol.controller import Controller
from joycontrol.controller_state import ControllerState, button_push
from joycontrol.memory import FlashMemory
from joycontrol.protocol import controller_protocol_factory
from joycontrol.server import create_hid_server

logger = logging.getLogger(__name__)

import socketio

sio = socketio.AsyncClient()



@sio.event(namespace='/controller')
async def pressKey(keyPack):
    app = sio
    print('Logging keystroke')
    print(keyPack)
    key = keyPack['key']
    time = keyPack['time']
    if (time != -1):
        await button_push(app.globalController, key, sec=time)
    else:
        await button_push(app.globalController, key)
    return True;

@sio.event(namespace='/controller')
async def manipulateJoystick(key):
    app = sio
    joyHorizontal = key['jH']
    joyVertical = key['jV']
    print(key)
    if (joyHorizontal == "c"):
        joyHorizontal = app.hCenter
    elif(joyHorizontal == "maxRight"):
        joyHorizontal = app.maxRight
    elif(joyHorizontal == "maxLeft"):
        joyHorizontal = app.maxLeft
    else:
        joyHorizontal = -1
        
    if (joyVertical == "c"):
        joyVertical = app.vCenter
    elif(joyVertical == "maxUp"):
        joyVertical = app.maxUp
    elif(joyVertical == "maxDown"):
        joyVertical = app.maxDown
    else:
        joyVertical = -1;
    if(joyVertical != -1):
        app.stick.set_v(joyVertical)
    if(joyHorizontal != -1):
        app.stick.set_h(joyHorizontal)
        
    print(joyHorizontal)
    print(joyVertical)
    return True;


async def pre_init(app, controller, reconnect_bt_addr=None, capture_file=None, spi_flash=None, device_id=None):
    factory = controller_protocol_factory(controller, spi_flash=spi_flash)
    ctl_psm, itr_psm = 17, 19
    transport, protocol = await create_hid_server(factory, reconnect_bt_addr=reconnect_bt_addr, ctl_psm=ctl_psm,
                                                  itr_psm=itr_psm, capture_file=capture_file, device_id=device_id)

    controller_state = protocol.get_controller_state()

    controller_state = protocol.get_controller_state()

    controller_state.l_stick_state.set_center()
    controller_state.r_stick_state.set_center()

    await controller_state.connect()
    
    app.stick = controller_state.l_stick_state
    calibration = app.stick.get_calibration()

    app.maxUp = calibration.v_center + calibration.v_max_above_center
    app.maxDown = calibration.v_center - calibration.v_max_below_center

    app.maxRight = calibration.h_center + calibration.h_max_above_center
    app.maxLeft = calibration.h_center - calibration.h_max_below_center

    app.vCenter = calibration.v_center
    app.hCenter = calibration.h_center
    app.globalController = controller_state
    
    app.stick.set_h(app.hCenter)
    app.stick.set_v(app.vCenter)
async def app_factory(controller, reconnect_bt_addr=None, capture_file=None, spi_flash=None, device_id=None):
    await pre_init(sio, controller, reconnect_bt_addr=reconnect_bt_addr, capture_file=capture_file, spi_flash=spi_flash, device_id=device_id)
    while(True):
        await sio.connect('http://192.168.3.24:80', namespaces=['/controller']);
        await sio.wait()


if __name__ == '__main__':
    # check if root
    if not os.geteuid() == 0:
        raise PermissionError('Script must be run as root!')

    # setup logging
    #log.configure(console_level=logging.ERROR)
    log.configure()

    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--device_id')
    parser.add_argument('--spi_flash')
    parser.add_argument('--log')
    parser.add_argument('-r', '--reconnect_bt_addr', type=str, default=None,
                        help='The Switch console Bluetooth address, for reconnecting as an already paired controller')
    args = parser.parse_args()

    controller = Controller.PRO_CONTROLLER

    spi_flash = None
    if args.spi_flash:
        with open(args.spi_flash, 'rb') as spi_flash_file:
            spi_flash = FlashMemory(spi_flash_file.read())
    with utils.get_output(path=args.log, default=None) as capture_file:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(app_factory(controller,
                  reconnect_bt_addr=args.reconnect_bt_addr,
                  capture_file=capture_file,
                  spi_flash=spi_flash,
                  device_id=args.device_id
                  ))

