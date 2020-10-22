var Points = [];

//jatos.onLoad(function() {
window.onload = function() {
  paper.install(window)
  paper.setup(document.getElementById('canvas'))

  // set up some options and the dat.gui panel
  var options = {
    drawWidth: 1,
    eraseWidth: 50,
    drawColor: '#000000',
    toolSelect: 'draw',
    clearCanvas: function() {
      topLayer.removeChildren()
    },
    Next:function(){
      jatos.startNextComponent()
    },
    End:function(){
      jatos.endStudy(topLayer.children, "everything worked fine");
    }
  }

  var gui = new dat.GUI()
  gui.addColor(options, 'drawColor')
  gui.add(options, 'drawWidth', 0.1, 50)
  gui.add(options, 'eraseWidth', 1, 100)
  gui.add(options, 'toolSelect', ['draw', 'erase','arrow']).onChange(function(value) {
    if (value === 'erase') {
      eraseTool.activate()
    } else if (value === 'draw') {
      drawTool.activate()
    }
    else{
      arrowTool.activate()
    }
  })
  
  gui.add(options, 'clearCanvas')
  gui.add(options,'Next')
  gui.add(options, 'End')

  // this layer holds the background pattern
  var bottomLayer = new Layer()


  // new layer for drawing and erasing on
  var topLayer = new Layer()

  // tool for drawing simple strokes on topLayer
  var drawTool = new Tool()
  drawTool.minDistance = 1

  drawTool.onMouseDown = function(event) {
    drawPath = new Path({
      strokeColor: options.drawColor,
      strokeWidth: options.drawWidth * view.pixelRatio,
      strokeCap: 'round',
      strokeJoin: 'round'
    })
  }

  drawTool.onMouseDrag = function(event) {
    drawPath.add(event.point)
    //Points.push(event.point)
    //console.log(Points);
    //jatos.submitResultData(Points);
  }

  drawTool.onMouseUp = function(event) {
    drawPath.selected = true
  }

  /// tool that draw arrow

  const Arrow = paper.Group.extend({
  initialize: function (args) {
    paper.Group.call(this, args)
    this._class = 'Arrow'
    this._serializeFields = Object.assign(this._serializeFields, {
      from: null,
      to: null,
      headSize: null
    })

    this.from = args.from
    this.to = args.to || args.from
    this.headSize = args.headSize

    // @NOTE
    // `paper.project.importJSON()` passes the deserialized children
    // (the arrow parts) to the `Group` superclass so there's no need to
    // create them again.
    if (this.children.length)
      return

    this.addChildren([
      new Path({
        ...args,
        strokeColor:options.drawColor,
       
       strokeCap: 'round',
       strokeJoin: 'round',
        segments: [
          this.from,
          this.from
        ]
      }),
      new Path({
        ...args,
        strokeColor:options.drawColor,
       
       strokeCap: 'round',
       strokeJoin: 'round',
        segments: [
          this.from,
          this.from
        ]
      }),
      new Path({
        ...args,
        strokeColor:options.drawColor,
       
       strokeCap: 'round',
       strokeJoin: 'round',
        segments: [
          this.from,
          this.from
        ]
      })
    ])

    this.update(this.to)
  },

  update: function (point) {
    const angle = this.from.subtract(point).angle - 90

    this.children[0].lastSegment.point = point

    this.children[1].firstSegment.point = point
    this.children[1].lastSegment.point = point.add(
      this.headSize,
      this.headSize
    )

    this.children[2].firstSegment.point = point
    this.children[2].lastSegment.point = point.add(
      -this.headSize,
      this.headSize
    )

    this.children[1].rotate(angle, point)
    this.children[2].rotate(angle, point)

    return this
  }
})

paper.Base.exports.Arrow = Arrow

/* Usage */



const arrowTool = new Tool()

let arrow

arrowTool.onMouseDown = e => {
  arrow = new Arrow({
    from: e.point,
    headSize: 2,
    strokeWidth: 1,
    strokeColor: '#555',
    strokeCap: 'round'
  })
}

arrowTool.onMouseDrag = e => {
  arrow.update(e.point)
  //document.write(e.point)
}


  // tool that 'erases' within the active layer only. first it simulates erasing
  // using a stroked path and blend modes while you draw. onMouseUp it converts
  // the toolpath to a shape and uses that to path.subtract() from each path

  var eraseTool = new Tool()
  eraseTool.minDistance = 10

  var path, tmpGroup, mask

  eraseTool.onMouseDown = function(event) {
    // TODO: deal w/ noop when activeLayer has no children
    //       right now we just draw in white

    // create the path object that will record the toolpath
    path = new Path({
      strokeWidth: options.eraseWidth * view.pixelRatio,
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeColor: 'white'
    })

    // learned about this blend stuff from this issue on the paperjs repo:
    // https://github.com/paperjs/paper.js/issues/1313

    // move everything on the active layer into a group with 'source-out' blend
    tmpGroup = new Group({
      children: topLayer.removeChildren(),
      blendMode: 'source-out',
      insert: false
    })

    // combine the path and group in another group with a blend of 'source-over'
    mask = new Group({
      children: [path, tmpGroup],
      blendMode: 'source-over'
    })
  }

  eraseTool.onMouseDrag = function(event) {
    // onMouseDrag simply adds points to the path
    path.add(event.point)
    //console.log(event.point)
  }

  eraseTool.onMouseUp = function(event) {
    // simplify the path first, to make the following perform better
    path.simplify()

    var eraseRadius = (options.eraseWidth * view.pixelRatio) / 2

    // find the offset path on each side of the line
    // this uses routines in the offset.js file
    var outerPath = OffsetUtils.offsetPath(path, eraseRadius)
    var innerPath = OffsetUtils.offsetPath(path, -eraseRadius)
    path.remove() // done w/ this now

    outerPath.insert = false
    innerPath.insert = false
    innerPath.reverse() // reverse one path so we can combine them end-to-end

    // create a new path and connect the two offset paths into one shape
    var deleteShape = new Path({
      closed: true,
      insert: false
    })
    deleteShape.addSegments(outerPath.segments)
    deleteShape.addSegments(innerPath.segments)

    // create round endcaps for the shape
    // as they aren't included in the offset paths
    var endCaps = new CompoundPath({
      children: [
        new Path.Circle({
          center: path.firstSegment.point,
          radius: eraseRadius
        }),
        new Path.Circle({
          center: path.lastSegment.point,
          radius: eraseRadius
        })
      ],
      insert: false
    })

    // unite the shape with the endcaps
    // this also removes all overlaps from the stroke
    deleteShape = deleteShape.unite(endCaps)
    deleteShape.simplify()

    // grab all the items from the tmpGroup in the mask group
    var items = tmpGroup.getItems({ overlapping: deleteShape.bounds })

    items.forEach(function(item) {
      var result = item.subtract(deleteShape, {
        trace: false,
        insert: false
      }) // probably need to detect closed vs open path and tweak these settings

      if (result.children) {
        // if result is compoundShape, yoink the individual paths out
        item.parent.insertChildren(item.index, result.removeChildren())
        item.remove()
      } else {
        if (result.length === 0) {
          // a fully erased path will still return a 0-length path object
          item.remove()
        } else {
          item.replaceWith(result)
        }
      }
    })

    topLayer.addChildren(tmpGroup.removeChildren())
    mask.remove()
  }
}
//});