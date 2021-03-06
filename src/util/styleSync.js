/**
 * Created by maxd on 27.02.17.
 * style utilities
 */
import {
	cloneDeep,
	chain,
	concat,
	difference,
	forOwn,
	get,
	has,
	isEqual,
	kebabCase,
	keys,
	map,
	omit,
	pickBy,
	range,
	reduce,
	set,
	transform,
	unset,
	value
} from 'lodash'
import {icon, getColor} from '../utils'

export const groupsPath = ['metadata', 'mapbox:groups'];
export const groupPath = ['metadata', 'mapbox:group'];

export function ensureStyleHasGroup(mvtStyle, groupData) {
	let {groupName, groupId} = groupData;
	let oGroups = get(mvtStyle, groupsPath);
	if (has(oGroups, '' + groupId)) {
		return mvtStyle;
	}

	// workaround because of _.set() produces an Array if last path-key numeric-like
	if (!has(mvtStyle, groupsPath)) {
		set(mvtStyle, groupsPath, {});
	}
	return set(mvtStyle, concat(groupsPath, groupId), {name: groupName, collapsed: false})
}

export function renameStyleGroup(mvtStyle, prevName, nextName) {
	let oGroups = get(mvtStyle, groupsPath);

	function reducer(acc, {name}, id) {
		acc[name] = id;
		return acc;
	}

	let groupsByName = reduce(oGroups, reducer, {});
	let groupId = groupsByName[prevName];

	return set(mvtStyle, concat(groupsPath, groupId, 'name'), nextName);
}

export function buildTreeData(mvtStyle) {
	let currentGroup = null;

	return reduce(cloneDeep(mvtStyle.layers), reducer, []);

	function reducer(result, value, key) {
		let _value = {
			id: value.id,
			icon: icon(value.type) || 'return',
			color: getColor(value)
		};

		let thisGroup = get(value, groupPath, null);
		if (!thisGroup) {
			result.push(_value);
			return result;
		}

		let groupName = get(mvtStyle, groupsPath.concat(thisGroup, 'name'), null);
		if (!groupName) {
			return result;
		}

		let groupItem;
		if (thisGroup !== currentGroup) {
			currentGroup = thisGroup;
			groupItem = {
				id: groupName,
				children: [_value]
			};
			result.push(groupItem)
		}
		else {
			groupItem = result[result.length - 1];
			groupItem.children.push(_value);
		}
		return result;
	}
}

export function getGroupIdByName(vStyle) {
	return reduce(get(vStyle, groupsPath), function (acc, v, k) {
		// console.log(`${k} :`,v, acc)
		acc[v.name] = k;
		return acc;
	}, {});
}

export function exportLayers(vStyle, layersTree, vIndex) {
	let groupMapIdByName = getGroupIdByName(vStyle);
	let vLayers = vStyle.layers;


	return reduce(layersTree, reducer, []);

	function reducer(result, value, key) {
		let groupId;
		if (has(value, 'children')) {
			groupId = groupMapIdByName[value.id];
			if (!groupId) throw new Error('(!) not found ', value.id, ' in ', groupMapIdByName);
			let children = map(value.children, child => set(child, 'groupId', groupId));
			return reduce(children, reducer, result)
		}

		if (!value.id) throw new Error(' couldnt find value.id', value.id);

		let layer = vLayers[vIndex[value.id]];
		groupId = get(value, 'groupId');
		if (groupId) {
			set(layer, groupPath, groupId);
			unset(value, 'groupId');
		} else {
			unset(layer, 'metadata');
		}
		result.push(layer);

		return result;
	}
}

export function updateLayers(vStyle, layers) {
	let nextStyle = cloneDeep(pickBy(vStyle, (v, k) => k !== 'layers'));

	nextStyle.layers = layers;
	return nextStyle;
}

export function exportStyle(vStyle, layersTree, vIndex) {
	vIndex = vIndex || indexLayers(vStyle.layers);
	let nextStyle = cloneDeep(pickBy(vStyle, (v, k) => k !== 'layers'));

	nextStyle.layers = exportLayers(vStyle, layersTree, vIndex);
	return nextStyle;
}

export function indexLayers(layers) {
	return reduce(layers, reducer, {});

	function reducer(result, value, index) {
		result[value.id] = index;
		return result;
	}
}

/**
 *
 * @param layersTree
 * @returns {*}
 * layerId: {leafIndex: number, groupIndex?: number}
 */
export function indexTree(layersTree) {
	return reduce(layersTree, reducer, {'__groups': {}});

	function reducer(acc, value, key) {
		if (value.children) {
			// acc[value.id] = {leafIndex: key, isGroup: true};
			acc.__groups[value.id] = key;
			let children = map(value.children, child => set(child, 'groupIndex', key));
			return reduce(children, reducer, acc);
		}
		else {
			let groupIndex = isFinite(value.groupIndex) ? value.groupIndex : -1;
			acc[value.id] = {groupIndex, leafIndex: key};
			unset(value, 'groupIndex');
			return acc;
		}
	}

}

export function objectDiff(curr, last) {
	let keysLast = keys(last),
		keysCurr = keys(curr),
		dropKeys = difference(keysLast, keysCurr);

	let update = pickBy(curr, function (v, k) {
		// console.log('k,v,last[k] = ' + k + ',' + v + ',' + last[k]);
		return !isEqual(last[k], v);
	});

	return {
		dropKeys,
		update
	};
}

// TODO: RE-THINK SMART UPDATE for cases 'source' and 'source-layer'
export function updateMapLayer(layerId, params, map) {

	let unhandledParams = {};
	let cmd = [];

	if (has(params, 'minzoom') && has(params, 'maxzoom')) {
		cmd.push(['setLayerZoomRange',[layerId, params.minzoom, params.maxzoom]]);
	}
	let procParams = omit(params, ['minzoom', 'maxzoom', 'id', 'metadata']);


	forOwn(procParams, function (value, name) {

//console.log('forOwn', name, '=>', value);
		if ('filter' === name) {
			cmd.push(['setFilter',[layerId, value]]);
		} else if ('layout' === name) {
			forOwn(value, function (v, k) {
				cmd.push(['setLayoutProperty',[layerId, k, v]]);
			});
		} else if ('paint' === name) {
			forOwn(value, function (v, k) {
				cmd.push(['setPaintProperty', [layerId, k, v]]);
			});
		} else {
			unhandledParams[name] = value;
		}
	});

	return {cmd, unhandledParams};
}

export function prettifyMapLayer(obj) {
	return chain(obj)
		.pickBy(function (v, k) {
			let typeOfValue = typeof v;
			return '_' !== k.charAt(0) && 'undefined' !== typeOfValue && 'function' !== typeOfValue;
		})
		.transform(function (res, v, k) {
			return res[kebabCase(k)] = v;
		}, {})
		.value();
}

export const newLayerTemplate = {
	"type": "background",
	"paint": {
		"background-color": "#f8f4f0"
	},
	"interactive": true
};

/**
 *
 * @param from layerId
 * @param to layerId
 */
export function layerRange(from, to) {
	if (from > to) {
		[from,to] = [to,from]
	}

	return range(from, to).concat(to);
}