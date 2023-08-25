import json
import argparse
import configparser
import logging
import sys
from importlib import import_module

# pip install pyyaml
try:
    import yaml
except ImportError:
    raise ImportError("you must install pyyaml via pip install pyyaml")
# pip install pyzabbix
try:
    from pyzabbix import ZabbixAPI, ZabbixAPIException
except ImportError:
    raise ImportError("you must install pyzabbix via pip install pyzabbix")
# pip install pyzabbix
try:
    import pysmi
except ImportError:
    raise ImportError("you must install pysmi via pip install pysmi")
named_libs = [('yaml', 'pyyaml')]
for (name, install) in named_libs:
    try:
        lib = import_module(name)
    except:
        raise ImportError(f"you must install {name} via pip install {install}")


#####################
# Argument handling #
#####################
def setup_arguments():
    parser = argparse.ArgumentParser(prog = 'Zabbix snmp discovery creation',
                                     description='small script to automatically create discovery and related items from input file.')

    parser.add_argument('-c', '--configfile',
                        help='path to config file',
                        dest='config',
                        type=str,
                        default='config.ini')
    
    parser.add_argument("-l", "--loglevel",
                        default='info',
                        choices=['debug', 'info', 'warning', 'error', 'critical'],
                        type=str,
                        help="set logging level")
    
    args = parser.parse_args()
    return args



################
# Initialising #
################
def setup_logger(loglevel):
    loglevel = loglevel.upper()
    logformatter = logging.Formatter('%(asctime)s %(levelname)s [%(name)s] %(message)s')
    rootlogger = logging.getLogger("create-snmp-discovery")
    
    # log debug to file
    filehandler = logging.FileHandler("debug/debug.log")
    filehandler.setFormatter(logformatter)
    rootlogger.addHandler(filehandler)
    
    # also log to stderr
    consolehandler = logging.StreamHandler()
    consolehandler.setFormatter(logformatter)
    rootlogger.addHandler(consolehandler)
    
    rootlogger.setLevel(loglevel)



def readconfig(configfile):
    try:
        config = configparser.ConfigParser()
        
        logging.debug('trying to read from configfile: %s', configfile)
        # TODO: add filepath validation
        config.read(configfile)
        logging.info('loaded config from file: %s', configfile)
        
        for i in ['API-KEY', 'API-URL']:
            if not config['ZABBIX'][i]:
                logging.error("%S not found in config", i)
                exit(2)
        return config['ZABBIX']
    
    except configparser.Error as e:
        logging.error('Configuration Error: %s', e)
        sys.exit(2)
    except KeyError:
        logging.error('Configuration Error: configuration not found in %s ', configfile)
        sys.exit(2)
        
def connect_to_zabbix(token, url):
    zabbix = ZabbixAPI(url)
    zabbix.login(token)
    return zabbix

##########
# Script #
##########

"""
method:

method: zabix.itemprototype.create
required params:
    ruleid (id of discovery rule)

"""
def main(args, config):
    #zabbix = connect_to_zabbix
    pysmi.

        
if __name__ == "__main__":
    args = setup_arguments()
    setup_logger(args.loglevel)
    config = readconfig(args.config)
    main(args, config)
    
    