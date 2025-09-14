export const Controls = ({ zoomState, getCanvasState }: any) => {
  // zoomState will be passed to all custom components
  const { scale } = zoomState;

  const onZoom = (action = "out") => {
    const canvasState = getCanvasState();
    const { canvasNode, currentPosition, d3Zoom } = canvasState || {};
    const { k: currentScale } = currentPosition || {};
    const diff = action === "out" ? -0.25 : 0.25;
    d3Zoom.scaleTo(canvasNode.transition().duration(500), currentScale + diff);
  };

  return (
    <div className="grid grid-flow-col auto-cols-max border border-[rgb(163,163,163)] rounded-lg">
      <div
        className="border-r border-[rgb(163,163,163)] text-[rgb(27,27,27)] text-[16px] font-medium py-1 px-2 bg-[rgb(221,221,221)] first:rounded-l-lg first:cursor-pointer"
        onClick={() => onZoom()}
      >
        -
      </div>
      <div className="border-r border-[rgb(163,163,163)] text-[rgb(27,27,27)] text-[16px] font-medium py-1 px-2 bg-[rgb(221,221,221)]">
        {Math.round(scale * 100)} %
      </div>
      <div
        className="border-r border-[rgb(163,163,163)] text-[rgb(27,27,27)] text-[16px] font-medium py-1 px-2 bg-[rgb(221,221,221)] last:rounded-r-lg last:cursor-pointer"
        onClick={() => onZoom("in")}
      >
        +
      </div>
    </div>
  );
};
