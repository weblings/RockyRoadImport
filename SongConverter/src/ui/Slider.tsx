import { Label, Slider as AriaSlider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components';

export interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step = 1, onChange }: SliderProps) {
    return (
        <AriaSlider className="ui-field ui-slider" value={value} minValue={min} maxValue={max} step={step} onChange={onChange}>
            <Label className="ui-field-label">{label}</Label>
            <div className="ui-slider-control">
                <SliderTrack className="ui-slider-track">
                    <SliderThumb className="ui-slider-thumb" />
                </SliderTrack>
                <SliderOutput className="ui-slider-output" />
            </div>
        </AriaSlider>
    );
}
