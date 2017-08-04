import Vue from 'vue'
import Vuex from 'vuex'
import * as types from './mutation-types'
import {indexLayers} from '../util/styleSync'

Vue.use(Vuex)

export const store = new Vuex.Store({
	state: {
		vStyle: {},  // virtual style

		vLayersIndex: {}, // layers index in sync with vStyle.layers
		currentLayerId: null,

		isLoading: false,
		modalProjectsShow: false,
		editorPaneShow: false,
		projectName: '',
		projectId: -1
	},
	getters: {
		getCurrentLayer: state => state.vLayersIndex[state.currentLayerId],
		getLayer: state => layerId => state.vStyle.layers[state.vLayersIndex[layerId]]
 	},
	mutations: {
		[types.SET_CURRENT_LAYER](state, payload) {
			state.currentLayerId = payload;
		},

		[types.TOGGLE_MODAL](state) {
			state.modalProjectsShow = !state.modalProjectsShow;
		},

		[types.SET_STYLE](state, payload) {
			state.vLayersIndex = indexLayers(payload.layers);
			state.vStyle = { ...payload };
		},
		
		[types.SET_LAYER](state, {layerId, value}) {
			let index = state.vLayersIndex[layerId];
			state.vStyle.layers.splice(index, 1, value);
		},
		[types.SET_PROJECT_DATA](state, payload) {
			state.projectId = payload.id;
			state.projectName =payload.name;
		},
		[types.SET_LOADING](state, status) {
			state.isLoading = status;
		},
		[types.EDITOR_PANE_SHOW](state, payload) {
			state.editorPaneShow = payload;
		}

	}
});