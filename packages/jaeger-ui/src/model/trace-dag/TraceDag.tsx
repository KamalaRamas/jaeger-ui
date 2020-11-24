// Copyright (c) 2018-2020 The Jaeger Authors.
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

import DenseTrace from './DenseTrace';
import { ancestralPathParentOrLeaf, TIdFactory } from './id-factories';
import { TDenseSpan, TDiffCounts, NodeID, TDenseSpanMembers } from './types';
import TDagNode from './types/TDagNode';
import { Trace } from '../../types/trace';

export default class TraceDag<TData extends { [k: string]: unknown } = {}> {
  static newFromTrace(trace: Trace, idFactory: TIdFactory = ancestralPathParentOrLeaf) {
    const dag: TraceDag<TDenseSpanMembers> = new TraceDag();
    const { denseSpansMap, rootIDs } = new DenseTrace(trace);

    function addDenseSpan(denseSpan: TDenseSpan | undefined, parentNodeID: NodeID | null) {
      if (!denseSpan) {
        // eslint-disable-next-line no-console
        console.warn(`Missing dense span`);
        return;
      }
      const { children, operation, service, skipToChild } = denseSpan;
      let id: NodeID | null;

      if (!skipToChild) {
        id = idFactory(denseSpan, parentNodeID);
        const node =
          dag.getNode(id) ||
          dag.addNode(id, parentNodeID, {
            operation,
            service,
            members: [],
          });
        node.members.push(denseSpan);
      } else {
        id = parentNodeID;
      }
      children.forEach((childId) => addDenseSpan(denseSpansMap.get(childId), id));
    }

    rootIDs.forEach((rootId) => addDenseSpan(denseSpansMap.get(rootId), null));
    return dag;
  }

  static diff(sdags: TraceDag<TDenseSpanMembers>[], idags: TraceDag<TDenseSpanMembers>[]) {
    const dag: TraceDag<TDiffCounts> = new TraceDag();

    function getEdge(t: TraceDag<TDenseSpanMembers>, id: NodeID) {
      const trace: TraceDag<TDenseSpanMembers> = t;
      const node = t.nodesMap.get(id);
      const parent_id = node ? (node.parentID ? node.parentID : null) : null;
      return parent_id
        ? { parent_id: parent_id, child_id: id, trace: trace }
        : { parent_id: '', child_id: id, trace: trace };
    }
    interface edge_vals {
      parent_id: string;
      child_id: string;
      trace: TraceDag<TDenseSpanMembers>;
    }

    var ids = sdags[0] ? [...sdags[0].nodesMap.keys()] : [];
    var all_before_edges: edge_vals[] = ids.map((id) => getEdge(sdags[0], id));
    for (var i = 1; i < sdags.length; i++) {
      const before_ids = sdags[i] ? [...sdags[i].nodesMap.keys()] : [];
      const before_edges: edge_vals[] = before_ids.map((id) => getEdge(sdags[i], id));
      all_before_edges = all_before_edges.concat(before_edges);
    }
    console.log('Before Edges');
    console.log(all_before_edges);

    var ids = idags[0] ? [...idags[0].nodesMap.keys()] : [];
    var all_after_edges: edge_vals[] = ids.map((id) => getEdge(idags[0], id));
    for (var i = 1; i < idags.length; i++) {
      const after_ids = idags[i] ? [...idags[i].nodesMap.keys()] : [];
      const after_edges: edge_vals[] = after_ids.map((id) => getEdge(idags[i], id));
      all_after_edges = all_after_edges.concat(after_edges);
    }
    console.log('After Edges');
    console.log(all_after_edges);

    var before_diff = [];
    for (var i = 0; i < all_before_edges.length; i++) {
      let be: edge_vals = all_before_edges[i];
      if (be.parent_id == '') continue;
      let match: boolean = false;
      for (var j = 0; j < all_after_edges.length; j++) {
        let ae: edge_vals = all_after_edges[j];
        if (ae.parent_id == '') continue;
        if (be.parent_id == ae.parent_id && be.child_id == ae.child_id) {
          match = true;
          break;
        }
      }
      if (match == false) {
        before_diff.push(be);
      }
    }
    console.log('Before Diff');
    console.log(before_diff);

    var after_diff = [];
    for (var j = 0; j < all_after_edges.length; j++) {
      let ae: edge_vals = all_after_edges[j];
      if (ae.parent_id == '') continue;
      let match: boolean = false;
      for (var i = 0; i < all_before_edges.length; i++) {
        let be: edge_vals = all_before_edges[i];
        if (be.parent_id == '') continue;
        if (be.parent_id == ae.parent_id && be.child_id == ae.child_id) {
          match = true;
          break;
        }
      }
      if (match == false) {
        after_diff.push(ae);
      }
    }
    console.log('After Diff');
    console.log(after_diff);

    let roots: edge_vals[] = [];
    let added = new Set();
    for (var i = 0; i < before_diff.length; i++) {
      let tmp1: edge_vals = before_diff[i];
      let match: boolean = false;
      for (var j = 0; j < before_diff.length; j++) {
        if (i == j) continue;
        let tmp2: edge_vals = before_diff[j];
        if (tmp2.child_id == tmp1.parent_id) {
          match = true;
          break;
        }
      }
      if (!match) {
        roots.push(tmp1);
        if (!added.has(tmp1.parent_id)) {
          added.add(tmp1.parent_id);
          /* Add parent node*/
          const pnode = tmp1.trace.nodesMap.get(tmp1.parent_id);
          const pnode_m = [...(pnode ? pnode.members : [])];
          dag.addNode(tmp1.parent_id, null, {
            members: pnode_m,
            a: pnode ? pnode.members : null,
            b: pnode ? pnode.members : null,
            operation: (pnode && pnode.operation) || '__UNSET__',
            service: (pnode && pnode.service) || '__UNSET__',
          });
        }

        if (!added.has(tmp1.child_id)) {
          added.add(tmp1.child_id);
          /* Add child node */
          const cnode = tmp1.trace.nodesMap.get(tmp1.child_id);
          const cnode_m = [...(cnode ? cnode.members : [])];
          dag.addNode(tmp1.child_id, tmp1.parent_id, {
            members: cnode_m,
            a: cnode ? cnode.members : null,
            b: null,
            operation: (cnode && cnode.operation) || '__UNSET__',
            service: (cnode && cnode.service) || '__UNSET__',
          });
        }
      }
    }
    for (var i = 0; i < after_diff.length; i++) {
      let tmp1: edge_vals = after_diff[i];
      let match: boolean = false;
      for (var j = 0; j < after_diff.length; j++) {
        if (i == j) continue;
        let tmp2: edge_vals = after_diff[j];
        if (tmp2.child_id == tmp1.parent_id) {
          match = true;
          break;
        }
      }
      if (!match) {
        roots.push(tmp1);
        if (!added.has(tmp1.parent_id)) {
          added.add(tmp1.parent_id);
          /* Add parent node*/
          const pnode = tmp1.trace.nodesMap.get(tmp1.parent_id);
          const pnode_m = [...(pnode ? pnode.members : [])];
          dag.addNode(tmp1.parent_id, null, {
            members: pnode_m,
            a: pnode ? pnode.members : null,
            b: pnode ? pnode.members : null,
            operation: (pnode && pnode.operation) || '__UNSET__',
            service: (pnode && pnode.service) || '__UNSET__',
          });
        }

        if (!added.has(tmp1.child_id)) {
          added.add(tmp1.child_id);
          /* Add child node */
          const cnode = tmp1.trace.nodesMap.get(tmp1.child_id);
          const cnode_m = [...(cnode ? cnode.members : [])];
          dag.addNode(tmp1.child_id, tmp1.parent_id, {
            members: cnode_m,
            a: null,
            b: cnode ? cnode.members : null,
            operation: (cnode && cnode.operation) || '__UNSET__',
            service: (cnode && cnode.service) || '__UNSET__',
          });
        }
      }
    }
    console.log('Result');
    console.log(roots);

    return dag;
  }

  nodesMap: Map<NodeID, TDagNode<TData>>;
  rootIDs: Set<NodeID>;

  constructor() {
    this.nodesMap = new Map();
    this.rootIDs = new Set();
  }

  hasNode(id: NodeID) {
    return this.nodesMap.has(id);
  }

  getNode(id: NodeID) {
    return this.nodesMap.get(id);
  }

  mustGetNode(id: NodeID) {
    const node = this.getNode(id);
    if (!node) {
      throw new Error(`Node not found: ${JSON.stringify(id)}`);
    }
    return node;
  }

  addNode(id: NodeID, parentID: NodeID | null, data: TData) {
    if (this.hasNode(id)) {
      throw new Error(`Node already added: ${JSON.stringify(id)}`);
    }
    const node: TDagNode<TData> = {
      ...data,
      id,
      parentID,
      children: new Set(),
    };
    this.nodesMap.set(id, node);
    if (!parentID) {
      this.rootIDs.add(id);
    } else {
      const parentNode = this.nodesMap.get(parentID);
      if (parentNode) {
        parentNode.children.add(id);
      }
    }
    return node;
  }
}
