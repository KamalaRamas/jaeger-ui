// Copyright (c) 2019-2020 The Jaeger Authors.
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

import { TVertexKey } from '@jaegertracing/plexus/lib/types';
import _get from 'lodash/get';
import _map from 'lodash/map';
import memoizeOne from 'memoize-one';

import convPlexus from '../../../model/trace-dag/convPlexus';
import TraceDag from '../../../model/trace-dag/TraceDag';
import { TDenseSpanMembers, TDiffCounts } from '../../../model/trace-dag/types';
import TDagPlexusVertex from '../../../model/trace-dag/types/TDagPlexusVertex';
import { Trace } from '../../../types/trace';
import filterSpans from '../../../utils/filter-spans';

function getUiFindVertexKeysFn(
  uiFind: string,
  vertices: TDagPlexusVertex<TDenseSpanMembers>[]
): Set<TVertexKey> {
  if (!uiFind) return new Set<TVertexKey>();
  const newVertexKeys: Set<TVertexKey> = new Set();
  vertices.forEach(({ key, data: { members } }) => {
    if (_get(filterSpans(uiFind, _map(members, 'span')), 'size')) {
      newVertexKeys.add(key);
    }
  });
  return newVertexKeys;
}

export const getUiFindVertexKeys = memoizeOne(getUiFindVertexKeysFn);

function getEdgesAndVerticesFn(aData: Trace[], sData: Trace[], iData: Trace[], itraces_success: boolean[]) {
  let adags = [];
  for (var i = 0; i < aData.length; i++) {
    const t = TraceDag.newFromTrace(aData[i]);
    adags.push(t);
  }
  let sdags = [];
  for (var i = 0; i < sData.length; i++) {
    const t = TraceDag.newFromTrace(sData[i]);
    sdags.push(t);
  }
  let idags = [];
  for (var i = 0; i < iData.length; i++) {
    const t = TraceDag.newFromTrace(iData[i]);
    idags.push(t);
  }

  const diffDag = TraceDag.diff(adags, sdags, idags, itraces_success);
  return convPlexus<TDiffCounts>(diffDag.nodesMap);
}

export const getEdgesAndVertices = memoizeOne(getEdgesAndVerticesFn);
