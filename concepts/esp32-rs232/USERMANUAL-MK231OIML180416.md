Weighing Indicator
User manual

User Manual
Safety instruction
For safety operation, pls. follow the safety instruction.
WARNING
Set, calibrate, inspect and fix the weighing indicator is prohibited by Non
professional staff.
WARNING
Pls. make sure the weighing display well earthing.
WARNING
The indicator is electrostatic sensitive device, pls. power off
during electrical connections, internal components touched by
hand is prohibited, and please take the anti-static measure.
Page 1 of 24

User Manual
LIST
1. Summary ..................................................................................................... 3
1.1 Main function .................................................................................... 3
1.2 Technical parameter .......................................................................... 3
1.3 Outline and installation picture ......................................................... 4
1.4 Battery ............................................................................................... 4
2. Installation and Calibration ......................................................................... 5
2.1 Connection indicator with load cell ................................................... 5
2.2 Communication interface .................................................................. 5
3. Basic operation ............................................................................................ 6
3.1 Key and display ................................................................................. 6
3.2 Power on............................................................................................ 8
3.3 Zero setting........................................................................................ 9
3.4 TARE ................................................................................................. 9
3.5 HOLD ................................................................................................ 9
3.6 TOTAL ............................................................................................ 10
3.7 Ten times high resolutions ............................................................... 11
3.8 Up and Low limit alarm .................................................................. 11
3.9 Print function ................................................................................... 11
4 Calibration & parameter setting ................................................................. 12
4.1 Enter calibration .............................................................................. 12
4.2 Step of calibration operation: .......................................................... 12
4.3 Application parameter setting .......................................................... 14
4.4 Communication setting ................................................................... 15
4.5 Application setting .......................................................................... 16
4.6 Exit setting ...................................................................................... 18
5.Output data format ..................................................................................... 18
5.1 Computer continuous sending format ............................................. 18
5.2 Big display continuous sending format ........................................... 19
5.3 Serial interface reception command： ............................................ 20
5.4 Print output format .......................................................................... 20
5.5 Print the accumulated output format ............................................... 21
6. Maintenance .............................................................................................. 21
6.1 Regular error and maintain method ................................................. 21
6.2 Daily maintenance ........................................................................... 22
6.3 Restore default parameters .............................................................. 22
Page 2 of 24

User Manual
1. Summary
1.1 Main function
》General weighing: zero tare
》Animal weighing: Peak-hold. Data-hold, Auto-hold
》Accumulation
》Optional by RS232
》Low battery alarm
》Power off automatically
1.2 Technical parameter
》Excitation voltage： +3.3 VDC
》A/D converting speed： 10 SPS
》Load signal range: 0~12.8mV
》Load capacity： it can connect 4 pcs 350Ω load cell at most
》Weight unit： kg
》Resolution： 3000e
》Interval： 1/2/5/10/20/50
》Display： 6-digits LED/LCD，digital height: 50mm
》Key： ON/OFF TOTAL HOLD TARE ZERO SET
》Interface： RS232C Baud rate optional 1200/2400/4800/9600
》Operation temperature： -10℃～+40℃
》Storage temperature： -20℃～+60℃
》Optional power： 4V/4Ah rechargeable battery
110/220VAC
Page 3 of 24

User Manual
1.3 Outline and installation picture
1.4 Battery
1. When you use the internal battery first time. You should charge the battery
10-12 hours to prevent low voltage resulted from self leakage of battery.
2. The battery voltage could be checked from the light on the right bottom of
the display. When low-voltage, “battery symbol” flickering and LOBAT
shining on LCD display; Red light flickering on LED display, then please
recharge the battery.
3. Charge time: 10-12 hours. And it works 40 hours.
Page 4 of 24

User Manual
4. When the battery light turns green on LED display or “battery marking”
all full on LCD display , it means charging finish.
5. If you don’t use the indicator for a long time, please take out the battery to
protect the indicator from the battery leakage.
2. Installation and Calibration
2.1 Connection indicator with load cell
It can connect four pcs 350Ω load cell at most, both four and six line load
cell are ok. To make it simple, we use quick connector or standard plug.
As below:
Quick connector connection
2.2 Communication interface
PIN2 -------- TXD
PIN3 -------- RXD
PIN5 -------- GND
Page 5 of 24

User Manual
3. Basic operation
3.1 Key and display
Weighing indicator display instruction
LED display Instruction
Weighing data display
Kg Weight unit kg
HOLD Hold the data
Page 6 of 24

User Manual
Tare Display tare status
Net Display net weight
Gross Display gross weight
Display data keep still
Zero, indicating zero weight
Battery Using battery
Hi Over Limit
OK Within Limit
Lo Below Limit
Total Accumulation
Count Counting function
Key’s function
ON/OFF, Exit and save setting
Left
Right
Down
Up
Confirm, Go to next step
Page 7 of 24

                                                 User Manual

| Key symbol  | Key name  | Key function  |
| ----------- | --------- | ------------- |

Work together with “on/off” enter and exit
SET
calibration

|     |       |                                 |
| --- | ----- | ------------------------------- |
|     | ZERO  | Clear weight within zero range  |

1.At Gross mode, tare the loaded weight
|     | TARE  | 2.At Net mode, display gross weight after  |
| --- | ----- | ------------------------------------------ |

deduct tare
|     |       |                             |
| --- | ----- | --------------------------- |
|     | HOLD  | Enter and exit “hold” mold  |

|     | TOTAL  | Accumulating operation  |
| --- | ------ | ----------------------- |

Press it for 2 seconds to power on or power
ON/OFF
|     |     | off  |
| --- | --- | ---- |

| 3.2 Power on  |     |     |
| ------------- | --- | --- |
 Power on and indicator perform self-checking and go to weighing mode.
  Page 8 of 24

User Manual
3.3 Zero setting
Within zero range, press “zero”, indicator weighing is cleared. When
Indicator is not stable, zero is unworkable.
3.4 TARE
At the gross weight mode, if the weight is stable, pls. press “Tare” key, the
indicator will take the loaded weight as tare, and show net weight.
At this time the gross mode will change to net mode. The “net” and “tare”
light is on, and the net weight is zero.
3.5 HOLD
C11=0 “hold” function unworkable
C11=1 PEAK HOLD
Press “HOLD” key, the Hold light is on, and show the maximum data on the
weighing indicator. Press “HOLD” key again to exit the hold function.
C11=2 Data-hold
Press “HOLD” key, the Hold light is on, and show the data on the weighing
indicator. Press “HOLD” key again to exit the hold function.
C11=3 Auto-hold
If the weight on the scales above 20d and keep stable, the indicator will show
the data for 6 seconds and the “ hold” light is on , after 6 seconds the
indicator back to general weighing, and the “ hold” light is off.
Page 9 of 24

User Manual
C11=4 Special Animal weighing function
Press “Hold” key, the indicator will show “LOC” for 3 seconds, the “hold”
light is on. During the 3 seconds, the indicator will catch the average weight
and show it.
Press “ HOLD” key again to exit it.
3.6 TOTAL
Accumulation operation
At Zero mode, load weight till stable, Press “TOTAL” key go to
accumulating mode, “ total” light on, display” n001”, and then display
loaded weight; unload weight , back to zero, load weight again till stable.
Press “TOTAL”, display“n002”, then show the loaded weight. Repeat it
maximum 999 times.
Check the total weight operation:
Press “SET” hold it then press “TOTAL”, at the same time, display “n**”,
(accumulating times) then display total weight.
There are 8 data totally. It shows the first 4 digital, then the last 4 digital.
For example, the first 4 digital is“0012”, the last 4 digital is“34,56”
It means the actual weight is “1234.56”.
At TOTAL (accumulate) mode, Press “TOTAL” key the indicator show “ clr
n”, it means don’t clear the total Weight, Press key to confirm it and
exit ; if clear total weight, Press or “clr n” change to “clr y”, it
means clear total weight display. Press to clear the the total weight and
exit accumulating mode.
Page 10 of 24

User Manual
3.7 Ten times high resolutions
Press “ SET” and “TARE” key at the same time, you will get 10 times high
resolutions. And it back to normal weighing after 3 seconds.
3.8 Up and Low limit alarm
Pls. set C13= Up limit, C14=Low Limit, when the weight is over up limit,
the “HI” light will be on, and indicator will make a sound to alarm.; when
the weight is below than the low limit, the “LO” light will be on.. when the
weight is within the limit, the “OK” light is on.
3.9 Print function
When the data is stable, connect with printer, it will be printed after press
1 second.
Page 11 of 24

User Manual
4 Calibration & parameter setting
4.1 Enter calibration
There are two methods to enter the setting menu:
1. When the switch “CAL” is off, Press then press at the same
time, hold it, you will enter C08-C39 setting.
2. Take out the sealing screw on the back of indicator, then press
down the “span” Press still and then press at the same time ,
you will enter C01-C39 setting.
4.2 Step of calibration operation:
According to the second method which can enter setting menu, C01-C39
C01 UNIT
[C01 ] Press
[C1 1] unit is kg
Press , go to next step
C02 Set decimal digits
Page 12 of 24

User Manual
[C02 ] Press
option：0/1/2/3/4
[C2 0] no decimal point
[C2 1] one decimal point
[C2 2] two decimal point
[C2 3] three decimal point
Press , go to next step
C03 Division setting
[C03 ] Press
[C3 1] d=1
[C3 2] d=2
[C3 5] d=5
[C3 10] d=10
[C3 20] d=20
[C3 50] d=50
Press , go to next step
C04 Maximum capacity
For example: max weighing 100kg:
set [0100.00]
Press , go to next step
C05 Zero calibration
option：0=non-calibration zero 1=need calibration zero
calibration zero please choose 1 and ensure scale is empty and “stable” light
is on. countdown[CAL 10]~[CAL 0], then the indicator will
show[0.00](example for two decimal point).
Page 13 of 24

User Manual
C06 Loading calibration
[C06], Press , show [C6 0], press , change to [C6 1], Press
, show [SPAn ],
Basic on max capacity setting, add suitable weight on scale. close to the max
capacity, heavier than 10% max at least.
For example: the weight is 80kg
As bellows:
[0080.00]
[CAL 9]
……
[0080.00]
[CALEnd]
count down over, indicator shows loaded weight , loading calibration finish.
If you want to set application parameter. Press If you want to exit.
Press
C07 Default parameters setting
[C7 0] non-restore default parameters
[C7 1] restore default parameters
Note: after the above parameters setting finish, please do not set default
parameters often, avoid the original setting parameters lost.
4.3 Application parameter setting
C08 warning tone
[C8 1] Open warning tone
[C8 0] Close warning tone
C09 Power off automatically
Page 14 of 24

User Manual
[C9 0] Non-power off
[C9 10] Keep still within 10 min. power off automatically
[C9 30] Keep still within 30 min. power off automatically
[C9 60] Keep still within 60 min. power off automatically
C10 Power saving setting
[C10 0] Close backlight
[C10 1] Close backlight after 1 minute
[C10 2] Always backlight
C11 Hold
[C11 0] No Hold function
[C11 1] Peck hold
[C11 2] Data hold
[C11 3] Auto-hold
[C11 4] Animal weighing
C12 Hold time ( if you choose C11=4, you can set the time )
[C12 3] 3 seconds
[C12 5] 5 seconds
C13 Upper limit alarm value
C14 Low limit alarm value
C15 Check inner code
4.4 Communication setting
C18 Serial interface setting
[C18 0] No sending
[C18 1] Big display
[C18 2] Print format output
[C18 3] Command mode(Z =zero T=tare R=Reply weight
[C18 4] continuous sending
C19 BAUD RATE
[C19 0] 1200bit/s
Page 15 of 24

User Manual
[C19 1] 2400bit/s
[C19 2] 4800bit/s
[C19 3] 9600bit/s
4.5 Application setting
C20 Manually Zero
[C20 00] No Manually Zero
[C20 01] Manually Zero range ±1% Max. capacity
[C20 02] Manually Zero range ±2% Max. capacity
[C20 04] Manually Zero range ±4% Max. capacity
[C20 10] Manually Zero range ±10% Max. capacity
[C20 20] Manually Zero range ±20% Max. capacity
[C20100] Manually Zero range ±100% Max. capacity
C21 Initially zero
[C21 0] No initially zero
[C21 1] Initially zero range±1% Max. capacity
[C21 2] Initially zero range±2% Max. capacity
[C21 5] Initially zero range±5% Max. capacity
[C21 10] Initially zero range±10% Max. capacity
[C21 20] Initially zero range±20% Max. capacity
C22 Zero tracking range
[C22 0.0] No zero tracking
[C22 0.5] ±0.5d
[C22 1.0] ±1.0d
[C22 2.0] ±2.0d
[C22 3.0] ±3.0d
[C22 4.0] ±4.0d
[C22 5.0] ±5.0d
C23 Zero tracking time
[C23 0] No zero tracking
Page 16 of 24

User Manual
[C23 1] 1 second
[C23 2] 2 seconds
[C23 3] 3 seconds
C24 Overload range
[C24 09] Over 9d than max. capacity
C25 Negative display
[C25 00] Less than -9d
[C25 10] Less -10% Max. capacity
[C25 20] Less -20% Max. capacity
[C25 50] Less -50% Max. capacity
[C25100] Less -100% Max. capacity
C26 Standstill time
[C26 0] Quick
[C26 1] Medium
[C26 2] Slow
C27 Standstill range
[C27 1] ±1d
[C27 2] ±2d
[C27 5] ±5d
[C27 10] ±10d
C28 Dynamic filter
[C28 0] Close dynamic filter
[C28 1] Low dynamic filter
[C28 3] Medium dynamic filter
[C28 5] High dynamic filter
C29 Noisy filter
[C29 0] Close noisy filter
[C29 1] Low noisy filter
[C29 2] Medium filter
[C29 3] High filter
Page 17 of 24

                                                 User Manual
4.6 Exit setting
For example [C10 1], Press  , confirm it then press   to exit and
save it

5.Output data format
5.1 Computer continuous sending format
|      ,  |     ,    |         |           |
| ------- | -------- | ------- | --------- |
CR  LF

S 1      S 2     S 3       Data           S 4

S1:    weight status, ST= standstill, US= not standstill, OL= overload
| S2:    weight mode, GS=gross mode, NT=net mode       |     |     |     |
| ---------------------------------------------------- | --- | --- | --- |
| S3:    weight of positive and negative, “+” or ” –“  |     |     |     |
| S4:    measurement unit, “kg” or “lb”                |     |     |     |
| Data:   weight value, including decimal point        |     |     |     |
| CR:    carriage return                               |     |     |     |
| LF:    line feed                                     |     |     |     |

  Page 18 of 24

                                                 User Manual
5.2 Big display continuous sending format
Output continuous format
| S  S  S  | S   |     |     |     |     | C   |
| -------- | --- | --- | --- | --- | --- | --- |
C
| T  W  W  | W  X  | X  X  | X  X  | X  X  X  | X  X  X  | X  K  |
| -------- | ----- | ----- | ----- | -------- | -------- | ----- |
R
| X  A  B  | C   |     |     |     |     | S     |
| -------- | --- | --- | --- | --- | --- | ----- |
| 1  2     | 3   |     |     | 4   |     | 5  6  |

State A
Bits0,1,2
| 0        | 1   |     | 2   |     | Decimal point position  |     |
| -------- | --- | --- | --- | --- | ----------------------- | --- |
| 1        | 0   |     | 0   |     | XXXXXX0                 |     |
| 0        | 1   |     | 0   |     | XXXXXXX                 |     |
| 1        | 1   |     | 0   |     | XXXXX．X                 |     |
| 0        | 0   |     | 1   |     | XXXX．XX                 |     |
| 1        | 0   |     | 1   |     | XXX．XXX                 |     |
| Bits3,4  |     |     |     |     | Division                |     |
| 0        |     | 1   |     |     | X1                      |     |
| 1        |     | 0   |     |     | X2                      |     |

State B
| BitsS  |     | function                        |     |     |     |     |
| ------ | --- | ------------------------------- | --- | --- | --- | --- |
| Bits0  |     | gross=0， net=1                  |     |     |     |     |
| Bits1  |     | symbol：positive =0，negative =1  |     |     |     |     |
| Bits2  |     | overload（or lower zero）=1       |     |     |     |     |
| Bits3  |     | dynamic=1                       |     |     |     |     |
| Bits4  |     | unit：lb=0, kg=1                 |     |     |     |     |
| Bits5  |     | Constant 1                      |     |     |     |     |
| Bits6  |     | Constant 0                      |     |     |     |     |
  Page 19 of 24

                                                 User Manual

State C
| Bit2   | Bit1  | Bit0  | unit        |
| ------ | ----- | ----- | ----------- |
| 0      | 0     | 0     | Kg or lb    |
| 0      | 0     | 1     | g           |
| 0      | 1     | 0     | t           |
| Bit 3  |       |       | printing=1  |
Extend
Bit 4
display=1
| Bit 5  |     |     | Constant 1  |
| ------ | --- | --- | ----------- |
| Bit 6  |     |     | Constant 0  |
5.3 Serial interface reception command
    RS232COM serial interface can receive simple ASCII command.
Command word and role as follows:
| Command  | name              | role                   |     |
| -------- | ----------------- | ---------------------- | --- |
| T        | Tare off command  | Save and clear tare    |     |
| Z        | Zero command      | Zero the gross weight  |     |
| P        | Print command     | Print the weight       |     |
| R        | Read gross/ net   | Read gross/net weight  |     |
weight
5.4 Print output format
   NET        XX.X kg
TARE       XX.X kg
GROSS    XXX.X kg

  Page 20 of 24

                                                 User Manual
5.5 Print the accumulated output format
Total:       003  (accumulate times，example for 3 times is 003)
Total:     2.88kg （accumulate weight）

6. Maintenance
6.1 Regular Error and maintain method
| Error   | Reason instruction        | Solution                       |                   |     |
| ------- | ------------------------- | ------------------------------ | ----------------- | --- |
|         | 1.the loaded weight       | 1.decrease loaded weight       |                   |     |
|         | excess overload range of  | 2.check load cell connection.  |                   |     |
|         | max. capacity             | 3.checking                     | load  cell：check  |     |
Display
|     | 2.wrong connection with  | input and output resistance to  |     |     |
| --- | ------------------------ | ------------------------------- | --- | --- |
UUUUUU
|     | load cell or no  | judge it is good or not.  |     |     |
| --- | ---------------- | ------------------------- | --- | --- |
connection with it.
3. load cell unworkable
|     | 1. calibration is no good  | 1.check                          | scale  is  resisted  | or  |
| --- | -------------------------- | -------------------------------- | -------------------- | --- |
|     | 2.cell single line is      | not, foot is kept level or not.  |                      |     |
|     | connect a wrong line.      | 2.check load cell connection.    |                      |     |
Display nnnnnn
|     | 3.the cell is bad.  | 3.checking  | load  cell：check  |     |
| --- | ------------------- | ----------- | ----------------- | --- |
input and output resistance to
judge it is good or not.
|     | during  calibration,  no  | input the correct weight  |     |     |
| --- | ------------------------- | ------------------------- | --- | --- |
|     | input  added  weight      | or                        |     |     |
ERR1
|     | input  weight  exceed  |     |     |     |
| --- | ---------------------- | --- | --- | --- |
max capacity.
  Page 21 of 24

                                                 User Manual
|       | during calibration, the  | added weight at least 10% of  |             |            |
| ----- | ------------------------ | ----------------------------- | ----------- | ---------- |
|       | added weights not        | Max.capacity, Recommend the   |             |            |
| ERR2  | enough                   | weights                       | is  60-80%  | the  Max.  |
capacity
|     | during calibration, input  | 1.check connection is correct  |     |     |
| --- | -------------------------- | ------------------------------ | --- | --- |
|     | single is negative.        | or not.                        |     |     |
check load cell is damaged or
ERR3
not.
|     |     | 3.  renew  | calibration,  | if  still  |
| --- | --- | ---------- | ------------- | ---------- |
wrong. pls replace the PCB
|     | during calibration,  | ensure added weight and scale  |     |     |
| --- | -------------------- | ------------------------------ | --- | --- |
ERR4
|       | single is unstable  | is stable, start calibration  |     |     |
| ----- | ------------------- | ----------------------------- | --- | --- |
| ERR5  | EEPROM check error  | change PCB.                   |     |     |

6.2Daily maintenance

   1. In order to ensure indicator display clearly and prolong use life, the
indicator should not be placed directly on sunlight.
   2. Load cell and indicator should be well connected , the system should
have a good ground, away from strong electric field, magnetic field.
   3. Do not use indicator outside in rainy, to keep it power off is better.
   4. Power off firstly while plug and unplug.
6.3 Restore default parameters
Enter setting menu, set  C07= 1,press  then press  exit saving
  Page 22 of 24

                                                 User Manual
setting, all parameters will be back to default setting.
Note：Pls. do not restore default parameter easily if you are not professional
and have not scale calibration.

Default parameter form
| Parameter  | Instruction                     | Default value  |
| ---------- | ------------------------------- | -------------- |
| C01        | Calibration unit                | 1              |
| C02        | Decimal digits                  | 0              |
| C03        | Division value                  | 1              |
| C04        | Max capacity                    | 10000          |
| C05        | Empty scales calibration        | 0              |
| C06        | Capacity calibration            | 0              |
| C07        | Restore the default parameters  | 0              |
| C08        | Warning tone                    | 1              |
| C09        | Automatic power off             | 0              |
| C10        | Power saving mode               | 0              |
| C11        | Hold function                   | 0              |
| C12        | Animal weighing mode            | 0              |
Upper limit warning
| C13  |                                       | 000000  |
| ---- | ------------------------------------- | ------- |
| C14  | Lower limit warning                   | 000000  |
| C15  | Inner code display                    |         |
| C16  | Date                                  |         |
| C17  | Time                                  |         |
| C18  | Serial interface data output methord  | 0       |
| C19  | Serial interface Baud rate            | 3=9600  |
| C20  | Manual zero setting                   | 2       |
| C21  | Initical zero setting                 | 10      |
| C22  | Automatic zero tracking range         | 0.5     |
| C23  | Automatic zero tracking time          | 1       |
  Page 23 of 24

                                                 User Manual
| C24      | Verload range           |     | 9   |
| -------- | ----------------------- | --- | --- |
| C25      | Negative display range  |     | 10  |
| C26      | Standstill time         |     | 1   |
| C27      | Standstill range        |     | 2   |
| C28      | Dynamic filter          |     | 0   |
| C29      | Noisy filter            |     | 2   |
| C30~C40  | Reseverd menu           |     |     |

|       |       |     |     |
| ----- | ----- | --- | --- |

  Page 24 of 24