// Copyright (c) 2018 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as React from 'react';
import { cacheAs, Digraph, LayoutManager } from '@jaegertracing/plexus';
import cx from 'classnames';
import { connect } from 'react-redux';

import renderNode, { getNodeEmphasisRenderer } from './renderNode';
import { getUiFindVertexKeys, getEdgesAndVertices } from './traceDiffGraphUtils';
import ErrorMessage from '../../common/ErrorMessage';
import LoadingIndicator from '../../common/LoadingIndicator';
import UiFindInput, { extractUiFindFromState, TExtractUiFindFromStateReturn } from '../../common/UiFindInput';
import { fetchedState } from '../../../constants';
import { FetchedTrace, TNil } from '../../../types';

import './TraceDiffGraph.css';

type Props = {
  steady_traces: Map<string, FetchedTrace>;
  incident_traces: Map<string, FetchedTrace>;
} & TExtractUiFindFromStateReturn;

const { classNameIsSmall, scaleOpacity, scaleStrokeOpacity } = Digraph.propsFactories;

export class UnconnectedTraceDiffGraph extends React.PureComponent<Props> {
  layoutManager = new LayoutManager({ useDotEdges: true, splines: 'polyline' });

  cacheAs = cacheAs.makeScope();

  componentWillUnmount() {
    this.layoutManager.stopAndRelease();
  }

  render() {
    const { steady_traces, incident_traces, uiFind = '' } = this.props;
    let sData = [];
    for (let [key, value] of steady_traces) {
      let f = value;
      let t = f ? f.data : null;
      if (t) sData.push(t);
    }
    let iData = [];
    for (let [key, value] of incident_traces) {
      let f = value;
      let t = f ? f.data : null;
      if (t) iData.push(t);
    }
    const { edges, vertices } = getEdgesAndVertices(sData, iData);
    const keys = getUiFindVertexKeys(uiFind, vertices);
    const dagClassName = cx('TraceDiffGraph--dag', { 'is-uiFind-mode': uiFind });
    const inputProps: Record<string, any> = {
      className: 'TraceDiffGraph--uiFind',
      suffix: uiFind.length ? String(keys.size) : undefined,
    };

    return (
      <div className="TraceDiffGraph--graphWrapper">
        <Digraph
          // `key` is necessary to see updates to the graph when a or b changes
          // TODO(joe): debug this issue in Digraph
          // key={`${a.id} vs ${b.id}`}
          key={`Compare sets of traces`}
          minimap
          zoom
          className={dagClassName}
          minimapClassName="u-miniMap"
          layoutManager={this.layoutManager}
          measurableNodesKey="nodes"
          layers={[
            {
              key: 'emphasis-nodes',
              layerType: 'svg',
              renderNode: getNodeEmphasisRenderer(keys),
            },
            {
              key: 'edges',
              layerType: 'svg',
              edges: true,
              defs: [{ localId: 'arrow' }],
              markerEndId: 'arrow',
              setOnContainer: this.cacheAs('edges/container', [
                scaleOpacity,
                scaleStrokeOpacity,
                { stroke: '#444' },
              ]),
            },
            {
              renderNode,
              key: 'nodes',
              measurable: true,
              layerType: 'html',
            },
          ]}
          setOnGraph={classNameIsSmall}
          edges={edges}
          vertices={vertices}
        />
        <UiFindInput inputProps={inputProps} />
      </div>
    );
  }
}

export default connect(extractUiFindFromState)(UnconnectedTraceDiffGraph);
