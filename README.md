# olorin-companion-app 

This companion app will work with both Firefox and Chrome, use the corresponding file for the browser that will be used. 

Download files
	Plugin
	Companion Application

## SetUp on Computer
Manage Extensions
Drag the Olorin-chrome to the Chrome Extension page.

Once the Olorin Companion file has been added to the computer that will be used, open Olorin Companion, set it to run on log in. 

Once the extension and Olorin companion app has been installed onto the computer, click the extension (toolbar) that has been installed- you should get a success - connected.

The next step will be to set up the printers that will be used by this computer. Go to the settings with Olorin.

A new browser pane will open and show the types of printing that can be setup:
		Receipt printer
		Sticker printer
		Pager Printer
		Full Sheet Printer

Click each one of these to the appropriate  printer for printing to. 

Save


## Koha Set Up

In the notices, we need to add some text to tell Koha which notice would go to which printer:
Issue Slip
Issue Quick Slip

Would probably go to the “receipt printer’

To do this, we will add some text at the bottom of each slip that needs to be connected to this printer plugin. 

For example: 

<button id= “webPrint” data-printer=“receipt_printer” data-print= ‘#receipt”>Print</button>

This code is saying use, web print, use the printer indicated within the quotes after data-printer, and then print all the text within the receipt. You must use the name of the printer from the Olorin settings.

Additionally, some code will be added to the notice to indicate what should print and disregard all the other text that we don’t want to print. 

Add this to the starting point of the actually slip you want to print:
Span id=“receipt”>

And then add this to the end of what you are looking to print

</span>

Lastly, to have this all go automatically, we will need to add some javascript in the system preference: IntranetSlipPrinterJS:

Set timeout (function () {$(#webPrint”), trigger (‘click) ; } 1000) ;
