import * as React from 'react'
import { PropTypes } from 'react'
import * as Relay from 'react-relay'
import { default as mapProps } from 'map-props'
import AddProjectMutation from '../../mutations/AddProjectMutation'
import LoginView from '../../views/LoginView/LoginView'
import { Viewer } from '../../types/types'
const classes: any = require('./RootRedirectView.scss')

interface Props {
  viewer: Viewer,
  projectName: string,
}

class RootRedirectView extends React.Component<Props, {}> {

  static propTypes = {
    viewer: PropTypes.object.isRequired,
    projectName: PropTypes.string,
  }

  static contextTypes = {
    router: PropTypes.object.isRequired,
  }

  context: {
    router?: any
  }

  constructor(props: Props) {
    super(props)
  }

  componentWillMount (): void {
    if (this.props.projectName) {
      this.context.router.replace(`/${this.props.projectName}`)
    }
  }

  shouldComponentUpdate (nextProps: Props): boolean {
    if (nextProps.projectName) {
      this.context.router.replace(`/${nextProps.projectName}`)
      return false
    }

    return true
  }

  _addProject (): void {
    const projectName = window.prompt('Project name')
    if (projectName) {
      Relay.Store.commitUpdate(
        new AddProjectMutation(
          {
            projectName,
            userId: this.props.viewer.user.id,
          }),
        {
          onSuccess: () => {
            analytics.track('global: created project', {
              project: projectName,
            })
            this.context.router.relpace(`/${projectName}`)
          },
        })
    }
  }

  render () {
    if (!this.props.projectName) {
      return (
        <div className={classes.addProject} onClick={this._addProject.bind(this)}>
          Add new project
        </div>
      )
    }

    return (
      <div>Redirecting...</div>
    )
  }
}

const MappedRootRedirectView = mapProps({
  viewer: (props) => props.viewer,
  projectName: (props) => (
   (props.viewer.user && props.viewer.user.projects.edges.length > 0)
     ? props.viewer.user.projects.edges[0].node.name
     : null
  ),
})(RootRedirectView)

export default Relay.createContainer(MappedRootRedirectView, {
  fragments: {
    // NOTE name needed because of relay bug
    viewer: () => Relay.QL`
      fragment on Viewer {
        id
        ${LoginView.getFragment('viewer')}
        user {
          id
          projects(first: 1) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `,
  },
})
