// Troika 3D exports

// 3D facades
export {PerspectiveCamera3DFacade, OrthographicCamera3DFacade} from './facade/Camera3DFacade.js'
export {default as Group3DFacade} from './facade/Group3DFacade.js'
export {default as HtmlOverlay3DFacade} from './facade/HtmlOverlay3DFacade.js'
export {AmbientLight3DFacade, DirectionalLight3DFacade, PointLight3DFacade, SpotLight3DFacade, HemisphereLight3DFacade, RectAreaLight3DFacade} from './facade/Light3DFacade.js'
export {default as Object3DFacade} from './facade/Object3DFacade.js'
export {default as Scene3DFacade} from './facade/Scene3DFacade.js'
export {default as World3DFacade} from './facade/World3DFacade.js'
export {makeWorldTextureProvider} from './facade/WorldTextureProvider.js'
export {default as InstancingManager} from './facade/instancing/InstancingManager.js'
export {default as Instanceable3DFacade} from './facade/instancing/Instanceable3DFacade.js'

// Primitives
export {BoxFacade} from './facade/primitives/BoxFacade.js'
export {CircleFacade} from './facade/primitives/CircleFacade.js'
export {CubeFacade} from './facade/primitives/CubeFacade.js'
export {MeshFacade} from './facade/primitives/MeshFacade.js'
export {PlaneFacade} from './facade/primitives/PlaneFacade.js'
export {SphereFacade} from './facade/primitives/SphereFacade.js'

// React entry point
export {default as Canvas3D} from './react/Canvas3D.js'

// Convenience shortcuts for some common submodule exports
export {Facade, ListFacade, ParentFacade} from 'troika-core'
export {createDerivedMaterial} from 'troika-three-utils'
