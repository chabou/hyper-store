import uuid from 'uuid';
import Immutable from 'seamless-immutable';

const HYPERSTORE_URL = 'https://hyper.is';

const defaultConfig = {
  debug: true,
  shortcut: 'ctrl+shift+s'
};

let config = defaultConfig;

const debug = function() {
  if (config.debug) {
    [].unshift.call(arguments, '|HYPER-STORE|');
    //eslint-disable-next-line no-console
    console.log.apply(this, arguments);
  }
};

export const decorateMenu = menu => {
  return menu.map(menuItem => {
    if (menuItem.label !== 'Plugins') {
      return menuItem;
    }
    menuItem.submenu = [
      ...menuItem.submenu,
      {
        type: 'separator'
      },
      {
        label: 'Open Hyper Store...',
        accelerator: config.shortcut,
        click(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.rpc.emit('hyper-store open');
          }
        }
      }
    ];
    return menuItem;
  });
};

function newTermGroup(obj) {
  return Immutable({
    uid: null,
    sessionUid: null,
    parentUid: null,
    direction: null,
    sizes: null,
    children: []
  }).merge(obj);
}

function newSession(obj) {
  return Immutable({
    uid: '',
    title: '',
    cols: null,
    rows: null,
    url: null,
    cleared: false,
    shell: '',
    pid: null
  }).merge(obj);
}

const fakeSession = newSession({
  uid: uuid.v4(),
  title: 'Hyper Store'
});

export const reduceSessions = (state, action) => {
  switch (action.type) {
    case 'HYPERSTORE_OPEN': {
      debug('reduceSessions: add fake session', fakeSession);
      return state.setIn(['sessions', fakeSession.uid], fakeSession);
    }
  }
  return state;
};

export const reduceTermGroups = (state, action) => {
  switch (action.type) {
    case 'HYPERSTORE_OPEN': {
      let uid = Object.keys(state.termGroups).find(termGroupUid => state.termGroups[termGroupUid].isHyperStore);
      if (!uid) {
        debug('reduceTermGroups: Create termGroup');
        // Create a Hyper Store tab
        uid = uuid.v4();
        const termGroup = newTermGroup({
          uid,
          sessionUid: fakeSession.uid,
          isHyperStore: true
        });
        state = state.setIn(['termGroups', termGroup.uid], termGroup);
      }

      return state.setIn(['activeSessions', uid], fakeSession.uid).set('activeRootGroup', uid);
    }
  }
  return state;
};

export const middleware = store => next => action => {
  if (action.type === 'SESSION_REQUEST') {
    // Skip pane creation if HyperStore is focused
    const {termGroups, activeRootGroup} = store.getState().termGroups;
    if (activeRootGroup && termGroups[activeRootGroup].isHyperStore) {
      debug('Skipping session creation');
      return;
    }
  }
  next(action);
};

export const decorateTerms = (Terms, {React}) => {
  return class HyperStoreTerms extends React.Component {
    componentDidMount() {
      debug('Terms did mount');
      window.rpc.on('hyper-store open', () => {
        debug('Dispatch open action');
        window.store.dispatch({
          type: 'HYPERSTORE_OPEN'
        });
      });
    }
    render() {
      return <Terms {...this.props} />;
    }
  };
};

export const decorateTermGroup = (TermGroup, {React}) => {
  return class HyperStoreTermGroup extends React.Component {
    constructor(props, context) {
      super(props, context);
      this.onLoad = this.onLoad.bind(this);
      this.onIframeRef = this.onIframeRef.bind(this);

      this.state = {
        isLoading: true
      };
    }
    onLoad() {
      this.setState({isLoading: false});
    }
    onIframeRef(ref) {
      if (!ref) {
        this.iframe.removeEventListener('load', this.onLoad);
      } else {
        ref.addEventListener('load', this.onLoad);
      }
      this.iframe = ref;
    }
    render() {
      const {isHyperStore} = this.props.termGroup;
      if (!isHyperStore) {
        return <TermGroup {...this.props} />;
      }
      const {isLoading} = this.state;
      const style = {
        display: isLoading ? 'none' : 'block'
      };
      return (
        <div style={{height: '100%'}}>
          {isLoading && <div>Loading...</div>}
          <iframe
            ref={this.onIframeRef}
            src={HYPERSTORE_URL}
            frameBorder="0"
            width="100%"
            height="100%"
            style={style}
          />
        </div>
      );
    }
  };
};
