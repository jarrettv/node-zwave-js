import { IDriver } from "../driver/IDriver";
import { ZWaveError, ZWaveErrorCodes } from "../error/ZWaveError";
import { validatePayload } from "../util/misc";
import { parseBitMask } from "../values/Primitive";
import {
	CCAPI,
	SetValueImplementation,
	SET_VALUE,
	throwUnsupportedProperty,
	throwWrongValueType,
} from "./API";
import {
	API,
	CCCommand,
	CCCommandOptions,
	ccValue,
	CommandClass,
	commandClass,
	CommandClassDeserializationOptions,
	expectedCCResponse,
	gotDeserializationOptions,
	implementedVersion,
} from "./CommandClass";
import { CommandClasses } from "./CommandClasses";

// All the supported commands
export enum ThermostatModeCommand {
	Set = 0x01,
	Get = 0x02,
	Report = 0x03,
	SupportedGet = 0x04,
	SupportedReport = 0x05,
}

export enum ThermostatMode {
	"Off" = 0x00,
	"Heat" = 0x01,
	"Cool" = 0x02,
	"Auto" = 0x03,
	"Auxiliary" = 0x04,
	"Resume (on)" = 0x05,
	"Fan" = 0x06,
	"Furnace" = 0x07,
	"Dry" = 0x08,
	"Moist" = 0x09,
	"Auto changeover" = 0x0a,
	"Energy heat" = 0x0b,
	"Energy cool" = 0x0c,
	"Away" = 0x0d,
	"Full power" = 0x0f,
	"Manufacturer specific" = 0x1f,
}

@API(CommandClasses["Thermostat Mode"])
export class ThermostatModeCCAPI extends CCAPI {
	protected [SET_VALUE]: SetValueImplementation = async (
		{ propertyName },
		value,
	): Promise<void> => {
		if (propertyName !== "mode") {
			return throwUnsupportedProperty(this.ccId, propertyName);
		}
		if (typeof value !== "number") {
			return throwWrongValueType(
				this.ccId,
				propertyName,
				"number",
				typeof value,
			);
		}
		await this.set(value);

		// Refresh the current value
		await this.get();
	};

	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	public async get() {
		const cc = new ThermostatModeCCGet(this.driver, {
			nodeId: this.endpoint.nodeId,
			endpoint: this.endpoint.index,
		});
		const response = (await this.driver.sendCommand<ThermostatModeCCReport>(
			cc,
		))!;
		return {
			mode: response.mode,
			manufacturerData: response.manufacturerData,
		};
	}

	public async set(
		mode: Exclude<
			ThermostatMode,
			typeof ThermostatMode["Manufacturer specific"]
		>,
	): Promise<void>;
	public async set(
		mode: typeof ThermostatMode["Manufacturer specific"],
		manufacturerData: Buffer,
	): Promise<void>;

	public async set(mode: any, manufacturerData?: any): Promise<void> {
		const cc = new ThermostatModeCCSet(this.driver, {
			nodeId: this.endpoint.nodeId,
			endpoint: this.endpoint.index,
			mode,
			manufacturerData,
		});
		await this.driver.sendCommand(cc);
	}

	public async getSupportedModes(): Promise<readonly ThermostatMode[]> {
		const cc = new ThermostatModeCCSupportedGet(this.driver, {
			nodeId: this.endpoint.nodeId,
			endpoint: this.endpoint.index,
		});
		const response = (await this.driver.sendCommand<
			ThermostatModeCCSupportedReport
		>(cc))!;
		return response.supportedModes;
	}
}

export interface ThermostatModeCC {
	ccCommand: ThermostatModeCommand;
}

@commandClass(CommandClasses["Thermostat Mode"])
@implementedVersion(1)
export class ThermostatModeCC extends CommandClass {}

type ThermostatModeCCSetOptions = CCCommandOptions &
	(
		| {
				mode: Exclude<
					ThermostatMode,
					typeof ThermostatMode["Manufacturer specific"]
				>;
		  }
		| {
				mode: typeof ThermostatMode["Manufacturer specific"];
				manufacturerData: Buffer;
		  });

@CCCommand(ThermostatModeCommand.Set)
export class ThermostatModeCCSet extends ThermostatModeCC {
	public constructor(
		driver: IDriver,
		options:
			| CommandClassDeserializationOptions
			| ThermostatModeCCSetOptions,
	) {
		super(driver, options);
		if (gotDeserializationOptions(options)) {
			// TODO: Deserialize payload
			throw new ZWaveError(
				`${this.constructor.name}: deserialization not implemented`,
				ZWaveErrorCodes.Deserialization_NotImplemented,
			);
		} else {
			this.mode = options.mode;
			if ("manufacturerData" in options)
				this.manufacturerData = options.manufacturerData;
		}
	}

	public mode: ThermostatMode;
	public manufacturerData?: Buffer;

	public serialize(): Buffer {
		const manufacturerData =
			this.mode === ThermostatMode["Manufacturer specific"] &&
			this.manufacturerData
				? this.manufacturerData
				: Buffer.from([]);
		const manufacturerDataLength = manufacturerData.length;
		this.payload = Buffer.concat([
			Buffer.from([
				((manufacturerDataLength & 0b111) << 5) + (this.mode & 0b11111),
			]),
			manufacturerData,
		]);
		return super.serialize();
	}
}

@CCCommand(ThermostatModeCommand.Report)
export class ThermostatModeCCReport extends ThermostatModeCC {
	public constructor(
		driver: IDriver,
		options: CommandClassDeserializationOptions | CCCommandOptions,
	) {
		super(driver, options);

		validatePayload(this.payload.length >= 1);
		this._mode = this.payload[0] & 0b11111;
		const manufacturerDataLength = this.payload[0] >>> 5;
		if (manufacturerDataLength) {
			this._manufacturerData = this.payload.slice(
				1,
				1 + manufacturerDataLength,
			);
		}
		this.persistValues();
	}

	private _mode: ThermostatMode;
	@ccValue()
	public get mode(): ThermostatMode {
		return this._mode;
	}

	private _manufacturerData: Buffer | undefined;
	@ccValue()
	public get manufacturerData(): Buffer | undefined {
		return this._manufacturerData;
	}
}

@CCCommand(ThermostatModeCommand.Get)
@expectedCCResponse(ThermostatModeCCReport)
export class ThermostatModeCCGet extends ThermostatModeCC {}

@CCCommand(ThermostatModeCommand.SupportedReport)
export class ThermostatModeCCSupportedReport extends ThermostatModeCC {
	public constructor(
		driver: IDriver,
		options: CommandClassDeserializationOptions,
	) {
		super(driver, options);
		// This bitmap starts at 0, so shift all values by 1
		this._supportedModes = parseBitMask(this.payload).map(mode => mode - 1);
		this.persistValues();
	}

	private _supportedModes: ThermostatMode[];
	@ccValue(true)
	public get supportedModes(): readonly ThermostatMode[] {
		return this._supportedModes;
	}
}

@CCCommand(ThermostatModeCommand.SupportedGet)
@expectedCCResponse(ThermostatModeCCSupportedReport)
export class ThermostatModeCCSupportedGet extends ThermostatModeCC {}