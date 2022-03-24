import { log, selectors, types, util } from "vortex-api";
import { IExtensionContext, INotification } from 'vortex-api/lib/types/api';
import { loadWasm } from "./wasmLoader";

const fs = require('fs');
const path = require('path');

const supportedGames: string[] = [ 'skyrimse', 'skyrimspecialedition', 'skyrimvr' ];
const modMapperBase: string = 'https://modmapper.com/';

const excludedPlugins = [
    "Skyrim.esm",
    "Update.esm",
    "Dawnguard.esm",
    "HearthFires.esm",
    "Dragonborn.esm",
].map(s => s.toLowerCase());

const gameIdConversions = {
    'skyrimse': 'skyrimspecialedition',
    'skyrimvr': 'skyrimspecialedition',
};

let hash_plugin = null;
const pluginHashes = {};

const modmapperModUrl = (gameId: string, modId: number): string => `${modMapperBase}?game=${gameId}&mod=${modId}`;
const modmapperPluginUrl = (hash: string): string => `${modMapperBase}?plugin=${hash}`;

function guessPluginPath(pluginName: string, api: types.IExtensionApi): string {
    const store = api.store
    const activeGameId = selectors.activeGameId(store.getState());
  
    const gamePath = util.getSafe(store.getState(), ['settings', 'gameMode', 'discovered', activeGameId, 'path'], undefined);
    return path.join(gamePath, 'Data', pluginName);
}

function hashPlugin(pluginName: string, api: types.IExtensionApi): Promise<string> {
    const pluginData = util.getSafe(api.store.getState(), ['session', 'plugins', 'pluginInfo', pluginName.toLowerCase()], undefined);
    const pluginPath = pluginData?.filePath ?? guessPluginPath(pluginName, api)
    return new Promise(async (resolve, reject) => {
        fs.readFile(pluginPath, async (err, data) => {
            if (err) {
                alert('Failed to read plugin: ' + err);
                reject(err);
                return;
            }

            if (typeof hash_plugin !== 'function') {
                // Wait a bit for wasm to get loaded before giving up
                try {
                    await new Promise<void>(resolve => setTimeout(() => {
                        if (typeof hash_plugin !== 'function') {
                            reject(new Error('Failed to load WebAssembly module. Cannot hash plugin.'));
                            return;
                        }
                        resolve();
                    }, 1000));
                } catch (err) {
                    reject(err);
                    return;
                }
            }
            const hash = hash_plugin(new Uint8Array(data.buffer, data.buffer.byteOffset, data.buffer.length)).toString(36); 
            resolve(hash);
        })
    });
}

// This is the main function Vortex will run when detecting the game extension. 
function main(context: IExtensionContext) {
    // WebAssembly must be loaded asynchronously in this environment (avoids blocking main thread),
    // so load it here during plugin initialization and save the wasm function in the scope to use in event handlers.
    loadWasm().then((wasm) => hash_plugin = wasm.hash_plugin);
    
    // Add button to the mods table.
    context.registerAction('mods-action-icons', 999, 'highlight-map', {}, 'See on Modmapper',
        (instanceIds: string[]) => {
            // Open the modmapper page
            const state = context.api.getState();
            const gameId = selectors.activeGameId(state);
            const mod = util.getSafe(state, ['persistent', 'mods', gameId, instanceIds[0]], undefined);
            // could not find the mod in the state. 
            if (!mod) return;
            // Get nexus game id for the mod.
            const downloadGame: string = mod.attributes?.downloadGame;
            const knownGames = util.getSafe(state, ['session', 'gameMode', 'known'], []);
            const game = knownGames.find(g => g.id === downloadGame)?.details?.nexusPageId ?? gameIdConversions[downloadGame] ?? downloadGame;

            const modId: number = mod.attributes?.modId;
            return util.opn(modmapperModUrl(game, modId)).catch((err) => log('error', 'Could not open web page', err));            
        },
        (instanceIds: string[]): boolean => {
            // Should we show the option?
            const state = context.api.getState();
            const gameId: string = selectors.activeGameId(state);
            const mod: (types.IMod | undefined) = util.getSafe(state, ['persistent', 'mods', gameId, instanceIds[0]], undefined);
            // Make sure this mod is from Nexus Mods
            const nexusMods: boolean = mod?.attributes?.source === 'nexus';
            // Make sure this is from a Nexus Mods section we support
            const gameIsSupported: boolean = supportedGames.includes(mod?.attributes?.downloadGame);
            // Make sure this mod has a mod ID
            const hasModId: boolean = !!mod?.attributes?.modId;

            return (nexusMods && gameIsSupported && hasModId);
        
        }
    );

    // Add button to the plugins table.
    context.registerAction('gamebryo-plugins-action-icons', 999, 'highlight-map', {}, ' See on Modmapper',
        (instanceIds: string[]) => {
            if (pluginHashes[instanceIds[0]]) {
                util.opn(modmapperPluginUrl(pluginHashes[instanceIds[0]])).catch((err) => log('error', 'Could not open web page', err));            
            } else {
                const notification: INotification = {
                    type: 'activity',
                    message: 'Generating the unique id for this plugin...',
                    title: 'Hashing plugin',
                };
                const notificationId = context.api.sendNotification(notification);

                hashPlugin(instanceIds[0], context.api).then(hash => {
                    pluginHashes[instanceIds[0]] = hash;
                    context.api.dismissNotification(notificationId);
                    util.opn(modmapperPluginUrl(hash)).catch((err) => log('error', 'Could not open web page', err));            
                }).catch(err => {
                    context.api.dismissNotification(notificationId);
                    throw(err);
                });
            }
            
        },
        (instanceIds: string[]) => {
            // Should we show the option?
            const state = context.api.getState();
            const gameId: string = selectors.activeGameId(state);
            // Make sure active game is a supported game
            const gameIsSupported: boolean = supportedGames.includes(gameId);
            // Make sure not a built-in game plugin
            const excluded = excludedPlugins.includes(instanceIds[0].toLowerCase());

            // TODO: if this is true, spin up child processes to compute the hash and cache it for later.
            // Will need to use a worker pool with queue of plugins to prevent overloading CPU.
            // (running on the main thread causes the UI to lock up)
            return gameIsSupported && !excluded;
        },
    );

    return true;
}

module.exports = {
    default: main,
};