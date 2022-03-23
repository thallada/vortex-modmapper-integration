import { log, selectors, types, util } from "vortex-api";
import { IExtensionContext } from 'vortex-api/lib/types/api';
import { loadWasm } from "./wasmLoader";

const supportedGames: string[] = [ 'skyrimse', 'skyrimspecialedition', 'skyrimvr' ];
const modMapperBase: string = 'https://modmapper.com/';

const modmapperModUrl = (gameId: string, modId: number): string => `${modMapperBase}?mod=${modId}&game=${gameId}`;

function pluginPath(pluginName : string, api : types.IExtensionApi): string {
    const store = api.store
    const activeGameId = selectors.activeGameId(store.getState());
  
    const gamePath = util.getSafe(store.getState(), ['settings', 'gameMode', 'discovered', activeGameId, 'path'], undefined);
    return `${gamePath}${pluginName}`;
}

//This is the main function Vortex will run when detecting the game extension. 
function main(context: IExtensionContext) {
    
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
            loadWasm(({ hash_plugin }) => alert(hash_plugin(new Uint8Array([1, 2, 3]))));
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
    context.registerAction('gamebryo-plugins-action-icons', 100, 'highlight-map', {}, 'See on Modmapper',
        (instanceIds: string[]) => {
            alert(pluginPath(instanceIds[0], context.api));
        },
        (instanceIds: string[]) => {
            return true;
        },
    );

    return true;
}

module.exports = {
    default: main,
};