import * as React from 'react'
import * as Relay from 'react-relay'
import ResetProjectDataMutation from '../../../mutations/ResetProjectDataMutation'
import ResetProjectSchemaMutation from '../../../mutations/ResetProjectSchemaMutation'
import DeleteProjectMutation from '../../../mutations/DeleteProjectMutation'
import {Viewer} from '../../../types/types'
import {showNotification} from '../../../actions/notification'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {withRouter} from 'react-router'
import {ShowNotificationCallback} from '../../../types/utils'

interface Props {
  viewer: Viewer
  params: any
  showNotification: ShowNotificationCallback
}

interface State {
  hoveredRowIndex: number
}

class DangerZone extends React.Component<Props, State> {

  state = {
    hoveredRowIndex: -1,
  }

  render() {
    return (
      <div className='container'>
        <style jsx={true}>{`
          .container {
            @inherit: .mt38, .bt, .pt38, .ph60, .bgBlack04;
            border-color: rgba(208,2,27,1);
          }

          .actionRow {
            @inherit: .flex, .justifyBetween, .itemsCenter, .pv25, .ph16;
          }

          .bottomBorderForActionRow {
            @inherit: .bb;
            border-color: rgba( 229, 229, 229, 1);
          }

          .solidOrange {
            color: rgba(241,143,1,1);
          }

          .orangeActionButton {
            color: rgba(241,143,1,1);
            background-color: rgba(241,143,1,.2);
          }

          .deleteRed100 {
            color: rgba(242,92,84,1);
          }

          .deleteBgrRed20 {
            background-color: rgba(242,92,84,.2);
          }

          .redActionButton {
            color: rgba(242,92,84,1);
            background-color: rgba(242,92,84,.2);
          }

          .actionButton {
            @inherit: .pv10, .ph16, .f16, .nowrap, .br2, .pointer;
          }

          .dangerZoneTitle {
            @inherit: .ttu, .f14, .fw6, .pl16, .pt25, .pb10;
            color: rgba(242,92,84,1);
          }

          .hoveredOrangeActionButton {
            @inherit: .white;
            background-color: rgba(241,143,1,1);
          }

          .hoveredRedActionButton {
            @inherit: .white;
            background-color: rgba(242,92,84,1);
          }

        `}</style>
        <div className='dangerZoneTitle'>Danger Zone</div>
        <div
          className='actionRow bottomBorderForActionRow'
        >
          <div>
            <div
              className={`fw3 f25 ${this.state.hoveredRowIndex === 0 ? 'solidOrange' : 'black50'}`}
            >
              Reset Project Data
            </div>
            <div
              className={`f16 ${this.state.hoveredRowIndex === 0 ? 'solidOrange' : 'black50'}`}
            >
              Delete all Nodes, but keep Models and Fields.
            </div>
          </div>
          <div
            className={`actionButton ${this.state.hoveredRowIndex === 0 ?
              'hoveredOrangeActionButton' : 'orangeActionButton'}`}
            onClick={this.onClickResetProjectData}
            onMouseEnter={() => this.setState({hoveredRowIndex: 0} as State)}
            onMouseLeave={() => this.setState({hoveredRowIndex: -1} as State)}
          >
            Reset Data
          </div>
        </div>
        <div
          className='actionRow bottomBorderForActionRow'
        >
          <div>
            <div
              className={`fw3 f25 ${this.state.hoveredRowIndex === 1 ? 'solidOrange' : 'black50'}`}
            >
              Reset Project Data & Models
            </div>
            <div
              className={`f16 ${this.state.hoveredRowIndex === 1 ? 'solidOrange' : 'black50'}`}
            >
              Delete everything inside the project.
            </div>
          </div>
          <div
            className={`actionButton ${this.state.hoveredRowIndex === 1 ?
              'hoveredOrangeActionButton' : 'orangeActionButton'}`}
            onClick={this.onClickResetCompleteProject}
            onMouseEnter={() => this.setState({hoveredRowIndex: 1} as State)}
            onMouseLeave={() => this.setState({hoveredRowIndex: -1} as State)}
          >
            Reset Everything
          </div>
        </div>
        <div
          className='actionRow'
        >
          <div>
            <div
              className='fw3 f25 deleteRed100'
            >
              Delete this Project</div>
            <div
              className='f16 deleteRed100'
            >
              That's the point of no return.</div>
            </div>
            <div
              className={`actionButton ${this.state.hoveredRowIndex === 2 ?
                'hoveredRedActionButton' : 'redActionButton'}`}
              onClick={this.onClickDeleteProject}
              onMouseEnter={() => this.setState({hoveredRowIndex: 2} as State)}
              onMouseLeave={() => this.setState({hoveredRowIndex: -1} as State)}
            >
              Delete Project</div>
          </div>
        </div>
    )
}

  private onClickResetProjectData = (): void => {
    if (window.confirm('Do you really want to reset the project data?')) {
      Relay.Store.commitUpdate(
        new ResetProjectDataMutation({
          projectId: this.props.viewer.project.id,
        }),
        {
          onSuccess: () => {
            console.log('SUCCESS')
            // this.props.router.replace(`/${this.props.params.projectName}/playground`)
          },
          onFailure: () => {
            console.error('Couldn ot delete stuff')
            // this.props.router.replace(`/${this.props.params.projectName}/playground`)
          },
        })
    }
  }

  private onClickResetCompleteProject = (): void => {
    if (window.confirm('Do you really want to reset the project data and models? ')) {
      Relay.Store.commitUpdate(
        new ResetProjectSchemaMutation({
          projectId: this.props.viewer.project.id,
        }),
        {
          onSuccess: () => {
            // this.props.router.replace(`/${this.props.params.projectName}/playground`)
          },
        })
    }
  }

  private onClickDeleteProject = (): void => {
    if (this.props.viewer.user.projects.edges.length === 1) {
      this.props.showNotification({
        message: `Sorry. You can't delete your last project. This one is a keeper.`,
        level: 'error',
      })
    } else if (window.confirm('Do you really want to delete this project?')) {
      Relay.Store.commitUpdate(
        new DeleteProjectMutation({
          projectId: this.props.viewer.project.id,
          customerId: this.props.viewer.user.id,
        }),
        {
          onSuccess: () => {
            // TODO replace hard reload
            // was added because deleting the last project caused
            // a relay issue
            window.location.pathname = '/'
          },
        })
    }
  }

}

const mapDispatchToProps = (dispatch) => {
  return bindActionCreators({showNotification}, dispatch)
}

const MappedDangerZone = connect(null, mapDispatchToProps)(withRouter(DangerZone))

export default Relay.createContainer(MappedDangerZone, {
  initialVariables: {
    projectName: 'Hallo', // TODO
  },
  fragments: {
    viewer: () => Relay.QL`
      fragment on Viewer {
        project: projectByName(projectName: $projectName) {
          id
          name
        }
        user {
          id
          projects(first: 10) {
            edges
          }
        }
      }
    `,
  },
})
