import { log, selectors, types, util } from "vortex-api";
import { IExtensionContext } from 'vortex-api/lib/types/api';
import { loadWasm } from "./wasmLoader";

const fs = require('fs');
const path = require('path');

const supportedGames: string[] = [ 'skyrimse', 'skyrimspecialedition', 'skyrimvr' ];
const modMapperBase: string = 'https://modmapper.com/';

const modmapperModUrl = (gameId: string, modId: number): string => `${modMapperBase}?mod=${modId}&game=${gameId}`;
const modmapperPluginUrl = (hash: string): string => `${modMapperBase}?plugin=${hash}`;

function pluginPath(pluginName: string, api: types.IExtensionApi): string {
    const store = api.store
    const activeGameId = selectors.activeGameId(store.getState());
  
    const gamePath = util.getSafe(store.getState(), ['settings', 'gameMode', 'discovered', activeGameId, 'path'], undefined);
    return path.join(gamePath, 'Data', pluginName);
}

//This is the main function Vortex will run when detecting the game extension. 
function main(context: IExtensionContext) {
    let hash_plugin = null;
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
            // Is this mod from gather the info about the mod.
            const game: string = mod.attributes?.downloadGame;
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
    context.registerAction('gamebryo-plugins-action-icons', 100, 'highlight-map', {}, ' See on Modmapper',
        (instanceIds: string[]) => {
            const pluginData = util.getSafe(context.api.store.getState(), ['session', 'plugins', 'pluginInfo', instanceIds[0].toLowerCase()], undefined);
            fs.readFile(pluginData?.filePath ?? pluginPath(instanceIds[0], context.api), (err, data) => {
                if (err) {
                    alert('Failed to read plugin: ' + err);
                    throw err;
                }

                if (hash_plugin === null) {
                    throw new Error('Failed to load WebAssembly module. Cannot hash plugin.');
                }
                const hash = hash_plugin(Uint8Array.from(Buffer.from(data))).toString(36); 
                util.opn(modmapperPluginUrl(hash)).catch((err) => log('error', 'Could not open web page', err));            
            })
            
        },
        (instanceIds: string[]) => {
            // Should we show the option?
            const state = context.api.getState();
            const gameId: string = selectors.activeGameId(state);
            // Make sure active game is a supported game
            const gameIsSupported: boolean = supportedGames.includes(gameId);
            return gameIsSupported;
        },
    );

    return true;
}

module.exports = {
    default: main,
};